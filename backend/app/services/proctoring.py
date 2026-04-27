from functools import lru_cache
from typing import Any

import numpy as np

from app.core.config import get_settings

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover
    YOLO = None  # type: ignore


@lru_cache
def _haar_cascade() -> Any:
    if cv2 is None:
        return None
    return cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


@lru_cache
def _yolo_model() -> Any:
    settings = get_settings()
    if YOLO is None:
        return None
    try:
        return YOLO(settings.proctor_yolo_model)
    except Exception:
        return None


def _decode_image(frame_bytes: bytes) -> Any:
    if cv2 is None:
        return None
    arr = np.frombuffer(frame_bytes, np.uint8)
    if arr.size == 0:
        return None
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _detect_with_yolo(image: Any) -> list[list[float]]:
    settings = get_settings()
    model = _yolo_model()
    if model is None:
        return []

    try:
        results = model.predict(source=image, conf=settings.proctor_frame_confidence, verbose=False)
    except Exception:
        return []

    boxes: list[list[float]] = []
    if not results:
        return boxes

    names = results[0].names or {}
    for box in results[0].boxes:
        cls = int(box.cls[0])
        label = str(names.get(cls, '')).lower()
        # Supports face model label or person fallback.
        if 'face' in label or label == 'person':
            xyxy = box.xyxy[0].tolist()
            boxes.append(xyxy)
    return boxes


def _detect_with_opencv(image: Any) -> list[list[float]]:
    if cv2 is None or image is None:
        return []
    cascade = _haar_cascade()
    if cascade is None:
        return []
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    return [[float(x), float(y), float(x + w), float(y + h)] for (x, y, w, h) in faces]


def analyze_proctor_frame(frame_bytes: bytes) -> dict[str, Any]:
    if cv2 is None:
        return {
            'suspicious': False,
            'reasons': [],
            'face_count': None,
            'model': 'unavailable',
        }

    image = _decode_image(frame_bytes)
    if image is None:
        return {
            'suspicious': False,
            'reasons': [],
            'face_count': 0,
            'model': 'opencv',
        }

    boxes = _detect_with_yolo(image)
    model_name = 'yolo' if boxes else 'opencv'
    if not boxes:
        boxes = _detect_with_opencv(image)

    face_count = len(boxes)
    reasons: list[str] = []

    if face_count == 0:
        reasons.append('no_face_detected')
    if face_count > 1:
        reasons.append('multiple_faces_detected')

    if face_count == 1:
        h, w = image.shape[:2]
        x1, y1, x2, y2 = boxes[0]
        face_w = max(1.0, x2 - x1)
        face_h = max(1.0, y2 - y1)
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        # Facing-camera heuristic: face should be reasonably centered and ratio stable.
        if cx < (w * 0.23) or cx > (w * 0.77) or cy < (h * 0.15) or cy > (h * 0.85):
            reasons.append('candidate_not_facing_camera')

        ratio = face_w / face_h
        if ratio < 0.55 or ratio > 1.7:
            reasons.append('candidate_face_angle_suspicious')

    return {
        'suspicious': bool(reasons),
        'reasons': reasons,
        'face_count': face_count,
        'model': model_name,
    }
