import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import BrandMark from '../components/brand/BrandMark';
import {
  InterviewAnswerSubmitResponse,
  InterviewEmailVerificationResponse,
  InterviewQuestion,
  ProctoringCheckResponse,
  InterviewStartResponse,
  InterviewTokenValidation,
} from '../types';

type PermissionState = {
  cameraMic: boolean;
  fullscreen: boolean;
  screenShare: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function chooseMimeType(kind: 'video' | 'audio'): string | undefined {
  const candidates =
    kind === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];

  for (const item of candidates) {
    if (MediaRecorder.isTypeSupported(item)) return item;
  }
  return undefined;
}

function hasLiveTrack(stream: MediaStream | null, kind: 'video' | 'audio'): boolean {
  if (!stream) return false;
  const tracks = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
  return tracks.some((track) => track.readyState === 'live' && track.enabled);
}

const INTERVIEW_API_BASE = '/interview';
const INTERVIEW_SHELL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;

export default function InterviewPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loadingValidation, setLoadingValidation] = useState(true);
  const [validation, setValidation] = useState<InterviewTokenValidation | null>(null);
  const [step, setStep] = useState(0);
  const [invalidMessage, setInvalidMessage] = useState('');

  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const [permissions, setPermissions] = useState<PermissionState>({
    cameraMic: false,
    fullscreen: false,
    screenShare: false,
  });
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [permPhase, setPermPhase] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [permError, setPermError] = useState('');

  const [interviewStarted, setInterviewStarted] = useState(false);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [startingInterview, setStartingInterview] = useState(false);
  const [finishingInterview, setFinishingInterview] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(30 * 60);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30 * 60);
  const [questionSeconds, setQuestionSeconds] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(10);
  const [isCompleting, setIsCompleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [warningCount, setWarningCount] = useState(0);
  const [warningMsg, setWarningMsg] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [terminatedOverlay, setTerminatedOverlay] = useState(false);

  const [captionSupported, setCaptionSupported] = useState(true);
  const [liveCaption, setLiveCaption] = useState('');
  const [finalCaption, setFinalCaption] = useState('');
  const [manualAnswerText, setManualAnswerText] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visualizerRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);

  const answerRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const answerChunksRef = useRef<Blob[]>([]);
  const sessionChunksRef = useRef<Blob[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartRecognitionRef = useRef(false);
  const isAnsweringRef = useRef(false);
  const finalCaptionRef = useRef('');
  const liveCaptionRef = useRef('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const questionTimerIntervalRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const terminateTimeoutRef = useRef<number | null>(null);
  const startCalledRef = useRef(false);

  const allPermissionsGranted = useMemo(
    () => permissionsGranted && permissions.cameraMic && permissions.fullscreen,
    [permissionsGranted, permissions],
  );

  useEffect(() => {
    isAnsweringRef.current = isAnswering;
  }, [isAnswering]);

  useEffect(() => {
    finalCaptionRef.current = finalCaption;
  }, [finalCaption]);

  useEffect(() => {
    liveCaptionRef.current = liveCaption;
  }, [liveCaption]);

  const stopSpeechRecognition = useCallback(() => {
    shouldRestartRecognitionRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // best effort
      }
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    stopSpeechRecognition();

    if (answerRecorderRef.current && answerRecorderRef.current.state !== 'inactive') {
      answerRecorderRef.current.stop();
    }
    if (sessionRecorderRef.current && sessionRecorderRef.current.state !== 'inactive') {
      sessionRecorderRef.current.stop();
    }

    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    displayStreamRef.current = null;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    window.speechSynthesis?.cancel();
  }, [stopSpeechRecognition]);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInvalidMessage('This interview link is invalid or expired.');
        setLoadingValidation(false);
        return;
      }
      try {
        const res = await api.get<InterviewTokenValidation>(`${INTERVIEW_API_BASE}/validate/${token}`);
        setValidation(res.data);
        if (!res.data.valid) {
          setInvalidMessage(res.data.message || 'This interview link is invalid or expired.');
          return;
        }
        try {
          await api.get(`${INTERVIEW_API_BASE}/${token}/open`);
        } catch {
          // best effort tracking call
        }
        setInvalidMessage('');
        setStep(0);
      } catch {
        setInvalidMessage('This interview link is invalid or expired.');
      } finally {
        setLoadingValidation(false);
      }
    }

    void validateToken();

    return () => {
      cleanupMedia();
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      if (questionTimerIntervalRef.current) window.clearInterval(questionTimerIntervalRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (terminateTimeoutRef.current) window.clearTimeout(terminateTimeoutRef.current);
      void exitFullscreen();
    };
  }, [token, cleanupMedia]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setPermissions((prev) => ({ ...prev, fullscreen: Boolean(document.fullscreenElement) }));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!showWarning) return;
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => {
      setShowWarning(false);
    }, 4000);
    return () => {
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    };
  }, [showWarning]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const stream = cameraStreamRef.current ?? cameraStream;
    if (!stream) return;
    video.srcObject = stream;
    void video.play().catch((e) => {
      console.warn('[CAMERA] play() failed:', e);
    });
  }, [cameraStream, interviewStarted, step]);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    displayStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!interviewStarted) return;
    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeftSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    };
  }, [interviewStarted]);

  useEffect(() => {
    if (!isAnswering) return;
    if (questionTimerIntervalRef.current) window.clearInterval(questionTimerIntervalRef.current);
    questionTimerIntervalRef.current = window.setInterval(() => {
      setQuestionSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (questionTimerIntervalRef.current) window.clearInterval(questionTimerIntervalRef.current);
    };
  }, [isAnswering]);

  async function requestFullscreenMode() {
    setError('');
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setPermissions((prev) => ({ ...prev, fullscreen: Boolean(document.fullscreenElement) }));
      return Boolean(document.fullscreenElement);
    } catch {
      setError('Fullscreen permission was not granted. Please enable fullscreen mode.');
      setPermissions((prev) => ({ ...prev, fullscreen: false }));
      return false;
    }
  }

  async function exitFullscreen() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // best effort
    }
  }

  function startMicVisualizer(stream: MediaStream) {
    const canvas = visualizerRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      if (!visualizerRef.current || !analyserRef.current) return;
      const width = visualizerRef.current.clientWidth || 640;
      const height = visualizerRef.current.clientHeight || 24;
      visualizerRef.current.width = width;
      visualizerRef.current.height = height;

      analyserRef.current.getByteFrequencyData(data);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#c9ced6';
      context.fillRect(0, 0, width, height);

      const bars = 64;
      const stepSize = Math.max(1, Math.floor(data.length / bars));
      const barWidth = width / bars;
      for (let i = 0; i < bars; i++) {
        const value = data[i * stepSize] ?? 0;
        const barHeight = Math.max(2, (value / 255) * height);
        context.fillStyle = i % 2 === 0 ? '#64748b' : '#475569';
        context.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }

  async function enableCameraMic() {
    setError('');
    try {
      const activeStream = cameraStreamRef.current ?? cameraStream;
      if (hasLiveTrack(activeStream, 'video') && hasLiveTrack(activeStream, 'audio')) {
        cameraStreamRef.current = activeStream;
        setPermissions((prev) => ({ ...prev, cameraMic: true }));
        await attachCamera();
        return true;
      }

      activeStream?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });

      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setPermissions((prev) => ({ ...prev, cameraMic: true }));
      startMicVisualizer(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch {
      setError('Camera and microphone access is required to continue.');
      setPermissions((prev) => ({ ...prev, cameraMic: false }));
      return false;
    }
  }

  async function enableScreenShare() {
    setError('');
    try {
      if (screenStream) {
        const activeTrack = screenStream.getVideoTracks().find((track) => track.readyState === 'live');
        if (activeTrack) {
          setPermissions((prev) => ({ ...prev, screenShare: true }));
          return true;
        }
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      setScreenStream(stream);
      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          setPermissions((prev) => ({ ...prev, screenShare: false }));
        };
      }
      setPermissions((prev) => ({ ...prev, screenShare: true }));
      return true;
    } catch {
      setError('Screen sharing permission is required to continue.');
      setPermissions((prev) => ({ ...prev, screenShare: false }));
      return false;
    }
  }

  async function verifyEmailAndContinue() {
    if (!token) return;
    setError('');
    setEmailError('');
    setStatusMessage('');
    setVerifyingEmail(true);
    try {
      const res = await api.post<InterviewEmailVerificationResponse>(`${INTERVIEW_API_BASE}/verify-email/${token}`, {
        email: emailInput,
      });
      if (!res.data.verified) {
        setEmailError("Email doesn't match our records. Please try again.");
        return;
      }
      setStep(1);
    } catch (err: any) {
      setEmailError("Email doesn't match our records. Please try again.");
      setError(err?.response?.data?.detail || 'Unable to verify email');
    } finally {
      setVerifyingEmail(false);
    }
  }

  function humanizeProctorReason(reason: string) {
    return reason
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async function reportProctoringEvent(eventType: string) {
    if (!token || !interviewStarted) return;
    try {
      const res = await api.post<ProctoringCheckResponse>(`${INTERVIEW_API_BASE}/proctor/event/${token}`, {
        event_type: eventType,
      });

      const data = res.data;
      const count = data.warning_count ?? 0;
      const limit = data.warning_limit ?? 4;
      const terminate = data.terminate_interview ?? false;
      setWarningCount(count);

      const reason = eventType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      setWarningMsg(`Warning ${count}/${limit}: ${reason}`);
      setShowWarning(true);

      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = window.setTimeout(() => {
        setShowWarning(false);
      }, 4000);

      if (terminate) {
        setWarningMsg('Interview terminated - warning limit exceeded');
        setShowWarning(true);
        setTerminatedOverlay(true);
        if (terminateTimeoutRef.current) window.clearTimeout(terminateTimeoutRef.current);
        terminateTimeoutRef.current = window.setTimeout(() => {
          navigate('/interview/complete');
        }, 3000);
        return;
      }
    } catch {
      // best effort
    }
  }

  async function grantCameraMic() {
    setPermError('');
    setPermissionsError('');
    setPermissionsLoading(true);
    try {
      const granted = await enableCameraMic();
      if (!granted) {
        throw new Error('camera_mic_denied');
      }
      setPermPhase(1);
    } catch {
      setPermError('Camera and microphone access denied. Please allow access in your browser settings and try again.');
    } finally {
      setPermissionsLoading(false);
    }
  }

  async function grantScreenShare() {
    setPermError('');
    setPermissionsError('');
    setPermissionsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setPermissions((prev) => ({ ...prev, screenShare: true }));
      stream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      displayStreamRef.current = null;
      setPermPhase(2);
    } catch {
      setPermissions((prev) => ({ ...prev, screenShare: false }));
      setPermPhase(2);
    } finally {
      setPermissionsLoading(false);
    }
  }

  async function grantFullscreen() {
    setPermError('');
    setPermissionsError('');
    setPermissionsLoading(true);
    try {
      const granted = await requestFullscreenMode();
      if (!granted) {
        throw new Error('fullscreen_blocked');
      }
      setPermPhase(3);
      setPermissionsGranted(true);
    } catch {
      setPermError('Fullscreen was blocked. Please allow fullscreen and try again.');
    } finally {
      setPermissionsLoading(false);
    }
  }

  useEffect(() => {
    if (!interviewStarted || !token) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        void reportProctoringEvent('tab_switch');
      }
    };

    const onFullscreenGuard = () => {
      if (!document.fullscreenElement) {
        void reportProctoringEvent('fullscreen_exit');
        document.documentElement.requestFullscreen().catch(() => {
          // best effort
        });
      }
    };

    const onCopy = () => {
      void reportProctoringEvent('copy_detected');
    };

    const onPaste = () => {
      void reportProctoringEvent('paste_detected');
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void reportProctoringEvent('context_menu');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'i') ||
        (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'j') ||
        (event.ctrlKey && event.key.toLowerCase() === 'u')
      ) {
        event.preventDefault();
        void reportProctoringEvent('devtools_shortcut');
      }
    };

    const devtoolsCheck = window.setInterval(() => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        void reportProctoringEvent('devtools_open');
      }
    }, 3000);

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenGuard);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearInterval(devtoolsCheck);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenGuard);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [interviewStarted, token]);

  function setupSpeechRecognition() {
    if (recognitionRef.current) return;
    const RecognitionCtor = getRecognitionCtor();
    if (!RecognitionCtor) {
      setCaptionSupported(false);
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let finals = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        const transcript = String(row?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        if (row.isFinal) {
          finals += `${transcript} `;
        } else {
          interim += `${transcript} `;
        }
      }

      if (finals.trim()) {
        setFinalCaption((prev) => `${prev} ${finals.trim()}`.trim());
      }
      setLiveCaption(interim.trim());
    };

    recognition.onerror = () => {
      // best effort
    };
    recognition.onend = () => {
      if (shouldRestartRecognitionRef.current && isAnsweringRef.current) {
        try {
          recognition.start();
        } catch {
          // best effort
        }
      }
    };

    recognitionRef.current = recognition;
  }

  function startSpeechRecognition() {
    setupSpeechRecognition();
    if (!recognitionRef.current) return;
    shouldRestartRecognitionRef.current = true;
    try {
      recognitionRef.current.start();
    } catch {
      // some browsers throw if already running
    }
  }

  function speakQuestion(questionText: string) {
    if (!('speechSynthesis' in window) || !questionText.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function loadQuestion(questionIndex: number): Promise<InterviewQuestion> {
    if (!token) {
      throw new Error('Interview token is missing.');
    }
    try {
      console.log('[Q] Fetching question', questionIndex);
      const res = await api.get<InterviewQuestion>(`${INTERVIEW_API_BASE}/question/${token}/${questionIndex}`);
      console.log('[Q]', res.status, res.data);
      setQuestion(res.data);
      setTotalQuestionsCount(res.data.total_questions || 10);
      setQuestionSeconds(0);
      setLiveCaption('');
      setFinalCaption('');
      setManualAnswerText('');
      liveCaptionRef.current = '';
      finalCaptionRef.current = '';
      speakQuestion(res.data.question_text);
      return res.data;
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Unable to load interview question.';
      console.error('[Q] Failed:', detail);
      throw new Error(detail);
    }
  }

  async function attachCamera() {
    if (!videoRef.current) return;
    if (!hasLiveTrack(cameraStreamRef.current, 'video')) {
      const granted = await enableCameraMic();
      if (!granted || !cameraStreamRef.current) return;
    }

    videoRef.current.srcObject = cameraStreamRef.current;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;
    try {
      await videoRef.current.play();
      console.log('[CAMERA] Playing');
    } catch (e) {
      console.warn('[CAMERA] play failed:', e);
    }
  }

  async function loadNextQuestion(totalQuestionsHint?: number): Promise<boolean> {
    if (!token) {
      throw new Error('Interview token is missing.');
    }

    let lastDetail = '';
    const maxQuestions = Math.max(1, totalQuestionsHint || totalQuestionsCount || 10);

    for (let i = 1; i <= maxQuestions; i += 1) {
      try {
        const res = await api.get<InterviewQuestion>(`${INTERVIEW_API_BASE}/question/${token}/${i}`);
        console.log('[RESUME] Resuming at Q', i);
        setQuestion(res.data);
        setTotalQuestionsCount(res.data.total_questions || maxQuestions);
        setAnsweredCount(Math.max(0, i - 1));
        setQuestionSeconds(0);
        setLiveCaption('');
        setFinalCaption('');
        setManualAnswerText('');
        liveCaptionRef.current = '';
        finalCaptionRef.current = '';
        speakQuestion(res.data.question_text);
        await attachCamera();
        return true;
      } catch (err: any) {
        lastDetail = err?.response?.data?.detail || '';
        continue;
      }
    }

    if (lastDetail.toLowerCase().includes('all questions')) {
      setError('All questions answered. Click Finish.');
      return false;
    }

    throw new Error(lastDetail || 'Unable to resume the interview.');
  }

  function startSessionRecorder() {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    const mimeType = chooseMimeType('video');
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    sessionChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) sessionChunksRef.current.push(event.data);
    };
    recorder.start(1000);
    sessionRecorderRef.current = recorder;
  }

  async function stopSessionRecorder(): Promise<Blob | null> {
    const recorder = sessionRecorderRef.current;
    if (!recorder) return null;

    if (recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }

    sessionRecorderRef.current = null;
    if (!sessionChunksRef.current.length) return null;
    return new Blob(sessionChunksRef.current, { type: recorder.mimeType || 'video/webm' });
  }

  async function startAnswerRecording() {
    if (!question || isAnswering || submittingAnswer || finishingInterview) return;

    if (!hasLiveTrack(cameraStreamRef.current, 'video') || !hasLiveTrack(cameraStreamRef.current, 'audio')) {
      const granted = await enableCameraMic();
      if (!granted || !cameraStreamRef.current) {
        setError('Camera and microphone are not active. Please allow access and try again.');
        setStatusMessage('');
        return;
      }
    }

    setError('');
    setStatusMessage('Recording answer...');
    setQuestionSeconds(0);
    setLiveCaption('');
    setFinalCaption('');
    setManualAnswerText('');
    liveCaptionRef.current = '';
    finalCaptionRef.current = '';

    try {
      const activeStream = cameraStreamRef.current;
      if (!activeStream) {
        throw new Error('Camera stream is unavailable.');
      }
      const mimeType = chooseMimeType('video');
      const recorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      answerChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) answerChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Recording failed. Please check camera and microphone access.');
        setStatusMessage('');
        setIsAnswering(false);
      };
      recorder.start(250);
      answerRecorderRef.current = recorder;

      startSpeechRecognition();
      setIsAnswering(true);
    } catch (e) {
      console.error('[RECORDER] Failed to start:', e);
      setError('Unable to start recording. Please check camera and microphone access.');
      setStatusMessage('');
      setIsAnswering(false);
    }
  }

  async function stopAnswerRecorder(): Promise<Blob | null> {
    const recorder = answerRecorderRef.current;
    if (!recorder) return null;

    if (recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }

    answerRecorderRef.current = null;
    if (!answerChunksRef.current.length) return null;
    return new Blob(answerChunksRef.current, { type: recorder.mimeType || 'video/webm' });
  }

  async function stopAndSubmitAnswer() {
    if (!token || !question || !isAnswering || submittingAnswer || finishingInterview) return;

    setSubmittingAnswer(true);
    setError('');
    setStatusMessage('Saving answer...');

    try {
      stopSpeechRecognition();
      const answerBlob = await stopAnswerRecorder();
      setIsAnswering(false);

      const transcript = (manualAnswerText || `${finalCaptionRef.current} ${liveCaptionRef.current}`).trim();
      const formData = new FormData();
      formData.append('question_index', String(question.question_index));
      if (transcript) {
        formData.append('answer_text', transcript);
      }
      if (answerBlob) {
        formData.append('answer_video', answerBlob, `q${question.question_index}.webm`);
      }

      const res = await api.post<InterviewAnswerSubmitResponse>(`${INTERVIEW_API_BASE}/answer/${token}`, formData);

      setQuestionSeconds(0);
      setLiveCaption('');
      setFinalCaption('');
      setManualAnswerText('');
      liveCaptionRef.current = '';
      finalCaptionRef.current = '';
      if (res.data.answer_saved) {
        setAnsweredCount((prev) => Math.max(prev, res.data.question_index));
      }

      if (res.data.interview_completed) {
        setStatusMessage('All answers saved. Finalizing interview...');
        await finishInterview();
        return;
      }

      if (res.data.next_question_index) {
        setStatusMessage('Answer saved. Loading next question...');
        try {
          await loadQuestion(res.data.next_question_index);
          await attachCamera();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to load the next question.');
          setStatusMessage('');
        }
      }
    } catch (err: any) {
      setIsAnswering(false);
      setError(err?.response?.data?.detail || 'Unable to submit answer');
      setStatusMessage('');
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function startInterview() {
    if (!token) return;
    if (startCalledRef.current || startingInterview) return;
    startCalledRef.current = true;

    setStartingInterview(true);
    setError('');
    setStatusMessage('');

    try {
      // Step 1: Ensure camera is ready
      if (!cameraStreamRef.current) {
        await enableCameraMic();
      }

      // Step 2: Call start endpoint (isolated catch — only network failures here)
      let startData: any = null;
      try {
        const startRes = await fetch(`/api/v1/interview/start/${token}`, { method: 'POST' });
        startData = await startRes.json();
        console.log('[START]', startRes.status, startData);

        if (!startRes.ok) {
          const msg = (startData?.detail || '').toLowerCase();
          if (msg.includes('already')) {
            console.log('[START] Already started - resuming');
            const resumed = await loadNextQuestion(startData?.total_questions || totalQuestionsCount || 10);
            if (!resumed) {
              startCalledRef.current = false;
              return;
            }
            setInterviewStarted(true);
            startSessionRecorder();
            setStatusMessage('Interview resumed. Continue with the next question.');
            return;
          }
          setError(startData?.detail || 'Unable to start interview');
          startCalledRef.current = false;
          return;
        }
      } catch (e: any) {
        console.error('[START] fetch error:', e);
        setError('Cannot reach server. Is backend running on port 8000?');
        startCalledRef.current = false;
        return;
      }

      // Step 3: Mark interview as started
      try {
        await loadQuestion(1);
      } catch (e) {
        console.error('[Q1] Load failed:', e);
        setError(e instanceof Error ? e.message : 'Unable to load the first question.');
        startCalledRef.current = false;
        return;
      }

      setInterviewStarted(true);
      setAnsweredCount(0);
      setTotalQuestionsCount(startData?.total_questions || 10);
      setTimeLimitSeconds((startData?.time_limit_minutes || 30) * 60);
      setTimeLeftSeconds((startData?.time_limit_minutes || 30) * 60);
      startSessionRecorder();

      // Step 4: Load first question (isolated — failure must not block the interview)
      try {
        await loadQuestion(1);
        setStatusMessage('Interview started. Listen to the question and click Start Answering.');
      } catch (e) {
        console.error('[Q1] Load failed:', e);
        setStatusMessage('Interview started. Question failed to load — please refresh.');
      }

      // Step 5: Attach camera (isolated — failure must not block the interview)
      try {
        if (cameraStreamRef.current && videoRef.current) {
          await attachCamera();
        } else {
          console.warn('[CAMERA] No stream/ref available:', cameraStreamRef.current, videoRef.current);
        }
      } catch (e) {
        console.warn('[CAMERA] attach failed:', e);
      }

    } finally {
      setStartingInterview(false);
    }
  }

  async function finishInterview() {
    if (!token || finishingInterview) return;
    if (isAnswering) {
      setError('Please click \"Stop & Submit\" for the current answer before finishing.');
      return;
    }
    if (answeredCount < totalQuestionsCount) {
      setError(`Interview is incomplete. Answer all ${totalQuestionsCount} questions before finishing.`);
      return;
    }

    setFinishingInterview(true);
    setIsCompleting(true);
    setError('');
    try {
      const sessionBlob = await stopSessionRecorder();
      const formData = new FormData();
      if (sessionBlob) {
        formData.append('video', sessionBlob, 'full_session.webm');
      }

      await api.post(`${INTERVIEW_API_BASE}/${token}/complete`, formData);

      cleanupMedia();
      await exitFullscreen();
      navigate('/interview/complete', {
        state: {
          candidateName,
          jobTitle,
          answeredCount: totalQuestionsCount,
          timeTaken: Math.max(0, timeLimitSeconds - timeLeftSeconds),
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to complete interview');
      setStatusMessage('');
    } finally {
      setFinishingInterview(false);
      setIsCompleting(false);
    }
  }

  const totalQuestions = totalQuestionsCount;
  const questionNumber = question?.question_index || 0;
  const progress = totalQuestions > 0 ? Math.round((questionNumber / totalQuestions) * 100) : 0;
  const progressPercent = ((step + 1) / 4) * 100;
  const formattedExpiry = validation?.expires_at ? new Date(validation.expires_at).toLocaleString() : 'Not available';
  const candidateName = validation?.candidate_name || 'Candidate';
  const jobTitle = validation?.job_title || 'Role Applied';

  if (loadingValidation) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <style>{INTERVIEW_SHELL_CSS}</style>
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            overflow: 'hidden',
            animation: 'popIn 0.3s ease both',
            padding: '34px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '3px solid #f0f0f0',
              borderTop: '3px solid #111',
              margin: '0 auto 14px',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: '14px', color: '#555' }}>Verifying your link...</div>
        </div>
      </div>
    );
  }

  if (invalidMessage) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <style>{INTERVIEW_SHELL_CSS}</style>
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            overflow: 'hidden',
            animation: 'popIn 0.3s ease both',
            padding: '30px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '62px',
              height: '62px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #0f766e, #f97316)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <BrandMark size={26} />
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: '#fff1ed',
              color: '#b93815',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '18px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            <AlertTriangle size={14} />
            Link unavailable
          </div>
          <div style={{ fontSize: '30px', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.04em', color: '#15231d', marginBottom: '12px' }}>
            This interview link can&apos;t be used.
          </div>
          <div style={{ fontSize: '14px', color: '#557266', lineHeight: 1.8 }}>{invalidMessage}</div>
        </div>
      </div>
    );
  }

  if (!interviewStarted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top left, rgba(20,184,166,0.14), transparent 24%), radial-gradient(circle at top right, rgba(249,115,22,0.12), transparent 22%), linear-gradient(135deg, #f4fbf7 0%, #eef8f4 55%, #f8f5ef 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Manrope', system-ui, sans-serif",
        }}
      >
        <style>{INTERVIEW_SHELL_CSS}</style>
        <div
          style={{
            background: 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(21,35,29,0.08)',
            borderRadius: '28px',
            width: '100%',
            maxWidth: '560px',
            overflow: 'hidden',
            animation: 'popIn 0.3s ease both',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.10)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '22px 24px 0',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                background: 'linear-gradient(135deg, #0f766e, #f97316)',
                borderRadius: '15px',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: '#fff',
                boxShadow: '0 12px 30px rgba(15, 118, 110, 0.24)',
              }}
            >
              <BrandMark size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#15231d',
                  letterSpacing: '-0.03em',
                }}
              >
                Smart Hiring Candidate Room
              </div>
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '12px',
                  color: '#678275',
                }}
              >
                Secure interview setup and monitored assessment
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 24px 0' }}>
            <div
              style={{
                height: '4px',
                background: '#e3efea',
                borderRadius: '99px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #0f766e, #f97316)',
                  borderRadius: '99px',
                  width: `${progressPercent}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: '24px',
              animation: 'fadeUp 0.3s ease both',
            }}
          >
            {step === 0 && (
              <>
                <StepIcon>
                  <Mail size={20} strokeWidth={2} />
                </StepIcon>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#15231d', marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  Verify your email
                </div>
                <div style={{ fontSize: '14px', color: '#557266', lineHeight: 1.75, marginBottom: '22px' }}>
                  Enter the email address you used when applying for this position.
                </div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#426155',
                    marginBottom: '6px',
                    display: 'block',
                  }}
                >
                  Registered email address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    border: '1px solid rgba(21,35,29,0.10)',
                    borderRadius: '16px',
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '14px',
                    color: '#15231d',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.92)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(15,118,110,0.30)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(21,35,29,0.10)';
                  }}
                />
                {emailError && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      marginTop: '10px',
                    }}
                  >
                    {emailError}
                  </div>
                )}
                <StepButton disabled={verifyingEmail || !emailInput.trim()} onClick={verifyEmailAndContinue}>
                  {verifyingEmail ? 'Verifying...' : 'Continue →'}
                </StepButton>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#7a9187',
                    marginTop: '12px',
                    textAlign: 'center',
                  }}
                >
                  Candidate: {candidateName} · Role: {jobTitle}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <StepIcon>
                  <ClipboardCheck size={20} strokeWidth={2} />
                </StepIcon>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#15231d', marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  Interview details
                </div>
                <div style={{ fontSize: '14px', color: '#557266', lineHeight: 1.75, marginBottom: '22px' }}>
                  Review the details of your interview before proceeding.
                </div>
                <InfoBox>
                  <InfoRow label="Position" value={jobTitle} />
                  <InfoRow label="Department" value="General" />
                  <InfoRow label="Questions" value="10 questions" />
                  <InfoRow label="Time limit" value="30 minutes" />
                  <InfoRow label="Answer format" value="Text, audio, or video" />
                  <InfoRow label="Link expires" value={formattedExpiry} />
                </InfoBox>
                <StepButton onClick={() => setStep(2)}>Continue →</StepButton>
              </>
            )}
            {step === 2 && (
              <>
                <StepIcon>
                  <ShieldCheck size={20} strokeWidth={2} />
                </StepIcon>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#15231d', marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  Required permissions
                </div>
                <div style={{ fontSize: '14px', color: '#557266', lineHeight: 1.75, marginBottom: '22px' }}>
                  Complete each permission in order before proceeding.
                </div>
                <InfoBox style={{ padding: '8px 14px' }}>
                  <SequentialPermissionRow
                    active={permPhase === 0}
                    completed={permPhase > 0}
                    background="#dbeafe"
                    color="#1e40af"
                    label="Camera & Microphone"
                    description="Required for video responses and face detection"
                    waiting={false}
                    optional={false}
                    loading={permissionsLoading && permPhase === 0}
                    disabled={permPhase !== 0}
                    onGrant={() => void grantCameraMic()}
                  />
                  <SequentialPermissionRow
                    active={permPhase === 1}
                    completed={permPhase > 1}
                    background="#ede9fe"
                    color="#5b21b6"
                    label="Screen Share"
                    description="Used for proctoring verification"
                    waiting={permPhase < 1}
                    optional
                    loading={permissionsLoading && permPhase === 1}
                    disabled={permPhase !== 1}
                    onGrant={() => void grantScreenShare()}
                  />
                  <SequentialPermissionRow
                    active={permPhase === 2}
                    completed={permPhase > 2}
                    background="#f0f0f0"
                    color="#555"
                    label="Full Screen"
                    description="Prevents distractions during interview"
                    waiting={permPhase < 2}
                    optional={false}
                    loading={permissionsLoading && permPhase === 2}
                    disabled={permPhase !== 2}
                    onGrant={() => void grantFullscreen()}
                    borderless
                  />
                </InfoBox>
                {permError && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      marginTop: '12px',
                    }}
                  >
                    {permError}
                  </div>
                )}
                {permPhase === 3 && (
                  <>
                    <div
                      style={{
                        background: '#dcfce7',
                        border: '1px solid #bbf7d0',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        marginTop: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#166534',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCheck size={18} />
                      All permissions granted - ready to start
                    </div>
                    <StepButton onClick={() => setStep(3)} style={{ background: '#16a34a' }}>
                      Continue to interview →
                    </StepButton>
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <StepIcon>
                  <CircleAlert size={20} strokeWidth={2} />
                </StepIcon>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#15231d', marginBottom: '8px', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  Before you start
                </div>
                <div style={{ fontSize: '14px', color: '#557266', lineHeight: 1.75, marginBottom: '22px' }}>
                  Read these carefully - you cannot pause the interview once it begins.
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#aaa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '10px',
                    }}
                  >
                    Interview rules
                  </div>
                  <RuleItem number={1}>
                    You have <strong>30 minutes</strong> to answer all 10 questions. The timer starts the moment you click Start.
                  </RuleItem>
                  <RuleItem number={2}>
                    Questions must be answered in order - you cannot skip, go back, or revisit answers.
                  </RuleItem>
                  <RuleItem number={3}>
                    Answer by typing, recording audio, or recording video. Choose what suits you best.
                  </RuleItem>
                  <RuleItem number={4}>
                    Complete the interview in one session. Closing the browser will end the interview.
                  </RuleItem>
                  <RuleItem number={5}>
                    This link is single-use. Once started, a new link can only be sent by the HR team.
                  </RuleItem>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#aaa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '18px',
                      marginBottom: '10px',
                    }}
                  >
                    Security monitoring
                  </div>
                  <RuleItem number="W1" type="warning">
                    Tab switching - Leaving this tab or minimising the browser counts as a violation.
                  </RuleItem>
                  <RuleItem number="W2" type="warning">
                    Fullscreen exit - Exiting fullscreen mode triggers an automatic warning.
                  </RuleItem>
                  <RuleItem number="W3" type="warning">
                    Multiple faces - If the camera detects more than one person in the frame, a warning is issued immediately.
                  </RuleItem>
                  <RuleItem number="W4" type="warning">
                    No face detected - Looking away from the camera for extended periods triggers warnings.
                  </RuleItem>
                  <RuleItem number="W5" type="warning">
                    Multiple voices - Background voices or people speaking near you will be flagged.
                  </RuleItem>
                  <RuleItem number="W6" type="warning">
                    Screen share - If screen share detects unauthorised content, it will be recorded.
                  </RuleItem>
                  <RuleItem number="W7" type="warning">
                    Copy/paste - Text copied from outside sources during the interview is logged.
                  </RuleItem>
                  <RuleItem number="W8" type="warning">
                    DevTools - Opening browser developer tools or inspect element triggers termination.
                  </RuleItem>
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '9px',
                      padding: '12px 14px',
                      marginTop: '14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      style={{ flexShrink: 0, marginTop: '1px' }}
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#b91c1c',
                          marginBottom: '3px',
                        }}
                      >
                        4 warnings = automatic termination
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#b91c1c',
                          lineHeight: 1.5,
                        }}
                      >
                        Accumulating 4 security violations will immediately end your interview and submit your current answers for evaluation. The HR team will be notified of all violations.
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void startInterview()}
                  disabled={startingInterview}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '11px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: startingInterview ? 'not-allowed' : 'pointer',
                    marginTop: '16px',
                    transition: 'background 0.15s, transform 0.12s',
                    opacity: startingInterview ? 0.7 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (!startingInterview) e.currentTarget.style.background = '#15803d';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#16a34a';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  type="button"
                >
                  {startingInterview ? 'Starting...' : 'Start interview - 30:00'}
                </button>
              </>
            )}
            {(permissionsError || error || statusMessage) && (
              <div style={{ marginTop: '14px' }}>
                {statusMessage && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#166534',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '9px 12px',
                    }}
                  >
                    {statusMessage}
                  </div>
                )}
                {permissionsError && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      marginTop: statusMessage ? '10px' : '0',
                    }}
                  >
                    {permissionsError}
                  </div>
                )}
                {error && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 12px',
                      marginTop: statusMessage || permissionsError ? '10px' : '0',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '6px',
              padding: '14px 0 16px',
            }}
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: step === item ? '#111' : '#e0e0e0',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(20,184,166,0.12), transparent 24%), radial-gradient(circle at top right, rgba(249,115,22,0.12), transparent 22%), linear-gradient(135deg, #f3fbf7 0%, #edf7f3 52%, #f7f4ee 100%)',
        padding: '24px',
        fontFamily: "'Manrope', system-ui, sans-serif",
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{INTERVIEW_SHELL_CSS}</style>
      {showWarning && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: warningCount >= 3 ? '#7f1d1d' : '#fef2f2',
            color: warningCount >= 3 ? '#fff' : '#b91c1c',
            border: warningCount >= 3 ? '1px solid #991b1b' : '1px solid #fecaca',
            borderRadius: '10px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideDown 0.3s ease',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {warningMsg}
          {warningCount === 3 && (
            <span style={{ marginLeft: '4px', fontSize: '12px', opacity: 0.85 }}>
              - Next = termination
            </span>
          )}
        </div>
      )}
      {terminatedOverlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>Interview terminated</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
              You exceeded the warning limit. Your answers have been submitted.
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: '1220px', margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '14px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.18em', color: '#678275', textTransform: 'uppercase', fontWeight: 700 }}>Smart Hiring Interview Room</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#15231d', marginTop: '6px', letterSpacing: '-0.04em' }}>
              {candidateName} · {jobTitle}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: warningCount > 0 ? '#fff1ed' : 'rgba(255,255,255,0.72)',
                border: `1px solid ${warningCount > 0 ? '#fdc9bb' : 'rgba(21,35,29,0.08)'}`,
                borderRadius: '999px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: warningCount > 0 ? '#b93815' : '#678275',
              }}
            >
              {warningCount}/4 warnings
            </div>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(21,35,29,0.08)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#15231d',
              }}
            >
              Interview Time: {formatTime(timeLeftSeconds)}
            </div>
            <button
              onClick={finishInterview}
              disabled={finishingInterview || submittingAnswer || isAnswering || answeredCount < totalQuestions}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: answeredCount >= totalQuestions ? 'linear-gradient(135deg, #0f766e, #115e59)' : '#c7d5cf',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: finishingInterview || submittingAnswer || isAnswering || answeredCount < totalQuestions ? 'not-allowed' : 'pointer',
                opacity: finishingInterview || submittingAnswer || isAnswering || answeredCount < totalQuestions ? 0.6 : 1,
              }}
              type="button"
            >
              {finishingInterview || isCompleting ? 'Finishing...' : 'Finish'}
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: '18px',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <section
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(21,35,29,0.08)',
              borderRadius: '28px',
              padding: '20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
              boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#678275', fontWeight: 700 }}>Question</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#15231d', marginTop: '6px', letterSpacing: '-0.05em' }}>
                  {questionNumber || '-'} / {totalQuestions}
                </div>
              </div>
              <div
                style={{
                  padding: '7px 10px',
                  borderRadius: '999px',
                  background: '#edf7f3',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f766e',
                }}
              >
                Progress {progress}%
              </div>
            </div>
            <div
              style={{
                marginTop: '16px',
                height: '4px',
                background: '#e3efea',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0f766e, #f97316)',
                  borderRadius: '999px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div
              style={{
                marginTop: '24px',
                flex: 1,
                minHeight: 0,
                borderRadius: '16px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(243,249,246,0.88))',
                border: '1px solid rgba(21,35,29,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px',
                textAlign: 'center',
                fontSize: '30px',
                lineHeight: 1.4,
                color: '#15231d',
                fontWeight: 600,
                overflow: 'hidden',
              }}
            >
              {question?.question_text || 'Press Start Interview to begin.'}
            </div>
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: '12px',
                  background: '#edf7f3',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0f766e',
                }}
              >
                Question Time: {formatTime(questionSeconds)}
              </div>
              <button
                type="button"
                onClick={() => question?.question_text && speakQuestion(question.question_text)}
                disabled={!question}
                style={{
                  padding: '10px 14px',
                  borderRadius: '11px',
                  border: '1px solid rgba(21,35,29,0.08)',
                  background: 'rgba(255,255,255,0.82)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#15231d',
                  cursor: question ? 'pointer' : 'not-allowed',
                  opacity: question ? 1 : 0.55,
                }}
              >
                Replay Question Voice
              </button>
            </div>
          </section>

          <section style={{ padding: '12px 16px 12px 0', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', minHeight: 0 }}>
            <div
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(21,35,29,0.08)',
                borderRadius: '24px',
                padding: '12px',
                flexShrink: 0,
                height: '220px',
                boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #0f766e, #115e59)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isAnswering ? '#fb7185' : '#d1d5db',
                    display: 'inline-block',
                  }}
                />
                REC
              </div>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '10px',
                  background: '#111',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.78)',
                border: '1px solid rgba(21,35,29,0.08)',
                borderRadius: '24px',
                padding: '14px 18px',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#678275', marginBottom: '10px', fontWeight: 700 }}>
                Audio Activity
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '5px 10px',
                    borderRadius: '999px',
                    background: '#edf7f3',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0f766e',
                  }}
                >
                  MIC
                </div>
                <canvas ref={visualizerRef} style={{ height: '32px', width: '100%', borderRadius: '999px', background: '#f0f0f0' }} />
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.78)',
                border: '1px solid rgba(21,35,29,0.08)',
                borderRadius: '24px',
                padding: '14px 18px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#678275', marginBottom: '10px', flexShrink: 0, fontWeight: 700 }}>
                Live Caption
              </div>
              <div style={{ flexShrink: 0, maxHeight: '72px', overflow: 'hidden', fontSize: '13px', lineHeight: 1.7, color: '#426155' }}>
                {`${finalCaption}${finalCaption && liveCaption ? ' ' : ''}${liveCaption}`.trim() || 'Speech caption will appear while answering.'}
              </div>
              {!captionSupported && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '12px',
                    color: '#92400e',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '8px 10px',
                  }}
                >
                  Browser live caption is not supported. Please use manual caption input below.
                </div>
              )}
              <textarea
                value={manualAnswerText}
                onChange={(e) => setManualAnswerText(e.target.value)}
                placeholder="Optional: type answer summary or corrections if needed."
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 0,
                  marginTop: '8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(21,35,29,0.10)',
                  padding: '10px 14px',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '13px',
                  color: '#15231d',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={startAnswerRecording}
                disabled={!interviewStarted || !question || isAnswering || submittingAnswer || finishingInterview}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #15231d, #243b31)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '11px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: !interviewStarted || !question || isAnswering || submittingAnswer || finishingInterview ? 'not-allowed' : 'pointer',
                  opacity: !interviewStarted || !question || isAnswering || submittingAnswer || finishingInterview ? 0.6 : 1,
                }}
                type="button"
              >
                Start Answer
              </button>
              <button
                onClick={stopAndSubmitAnswer}
                disabled={!interviewStarted || !isAnswering || submittingAnswer || finishingInterview}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #0f766e, #f97316)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '11px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: !interviewStarted || !isAnswering || submittingAnswer || finishingInterview ? 'not-allowed' : 'pointer',
                  opacity: !interviewStarted || !isAnswering || submittingAnswer || finishingInterview ? 0.6 : 1,
                }}
                type="button"
              >
                {submittingAnswer ? 'Saving...' : 'Stop & Submit'}
              </button>
            </div>
          </section>
        </div>

        {(statusMessage || error) && (
          <div style={{ marginTop: '16px' }}>
            {statusMessage && (
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#166534',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              >
                {statusMessage}
              </div>
            )}
            {error && (
              <div
                style={{
                  fontSize: '12.5px',
                  color: '#b91c1c',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginTop: statusMessage || permissionsError ? '10px' : '0',
                }}
              >
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionCard({
  title,
  subtitle,
  granted,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  granted: boolean;
  actionLabel: string;
  onAction: () => void | Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            granted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {granted ? 'Granted' : 'Pending'}
        </span>
      </div>
      <button
        onClick={() => void onAction()}
        className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function StepIcon({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '52px',
        height: '52px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(15,118,110,0.12), rgba(249,115,22,0.14))',
        color: '#0f766e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}
    >
      {children}
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={() => void onClick()}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0f766e, #115e59)',
        color: '#fff',
        border: 'none',
        borderRadius: '16px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        marginTop: '16px',
        transition: 'background 0.15s, transform 0.12s',
        opacity: disabled ? 0.65 : 1,
        boxShadow: '0 16px 34px rgba(15,118,110,0.18)',
        ...style,
      }}
      onMouseOver={(e) => {
        if (!disabled) e.currentTarget.style.filter = 'brightness(1.03)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.filter = 'none';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function InfoBox({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(244,249,246,0.88))',
        borderRadius: '18px',
        padding: '16px 18px',
        border: '1px solid rgba(21,35,29,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '8px',
      }}
    >
      <span style={{ fontSize: '11px', color: '#7a9187', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#15231d', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function PermissionRow({
  icon,
  text,
  background,
  color,
  badgeBg,
  badgeColor,
  badgeText,
  borderless = false,
}: {
  icon: ReactNode;
  text: string;
  background: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  badgeText: string;
  borderless?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 0',
        borderBottom: borderless ? 'none' : '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: '#444', lineHeight: 1.5 }}>{text}</div>
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: '5px',
          background: badgeBg,
          color: badgeColor,
          flexShrink: 0,
        }}
      >
        {badgeText}
      </span>
    </div>
  );
}

function InstructionItem({
  number,
  children,
}: {
  number: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #15231d, #243b31)',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
          marginTop: '1px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {number}
      </div>
      <div style={{ fontSize: '13px', color: '#426155', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function RuleItem({
  number,
  children,
  type = 'rule',
}: {
  number: number | string;
  children: ReactNode;
  type?: 'rule' | 'warning';
}) {
  const isWarning = type === 'warning';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginBottom: '10px',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: isWarning ? '4px' : '50%',
          background: isWarning ? '#fff1d6' : 'linear-gradient(135deg, #15231d, #243b31)',
          color: isWarning ? '#9a5c08' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {isWarning ? '!' : number}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#426155',
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SequentialPermissionRow({
  label,
  description,
  background,
  color,
  active,
  completed,
  waiting,
  optional,
  loading,
  disabled,
  onGrant,
  borderless = false,
}: {
  label: string;
  description: string;
  background: string;
  color: string;
  active: boolean;
  completed: boolean;
  waiting: boolean;
  optional?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onGrant: () => void;
  borderless?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        borderBottom: borderless ? 'none' : '1px solid rgba(0,0,0,0.05)',
        opacity: waiting ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: completed ? '#dcfce7' : background,
          color: completed ? '#16a34a' : color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: active ? '1px solid rgba(15,118,110,0.26)' : '1px solid transparent',
          boxShadow: active ? '0 0 0 4px rgba(20,184,166,0.10)' : 'none',
        }}
      >
        {completed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{optional ? 'S' : label[0]}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: waiting ? '#92a79d' : '#15231d' }}>{label}</div>
        <div style={{ fontSize: '12px', color: waiting ? '#92a79d' : '#557266', lineHeight: 1.6 }}>{description}</div>
      </div>
      {completed ? (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#166534',
            background: '#dcfce7',
            borderRadius: '999px',
            padding: '5px 9px',
            flexShrink: 0,
          }}
        >
          Granted ✓
        </span>
      ) : active ? (
        <button
          type="button"
          onClick={onGrant}
          disabled={loading || disabled}
          style={{
            border: 'none',
            background: 'linear-gradient(135deg, #0f766e, #115e59)',
            color: '#fff',
            borderRadius: '12px',
            padding: '9px 13px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading || disabled ? 'not-allowed' : 'pointer',
            opacity: loading || disabled ? 0.65 : 1,
            flexShrink: 0,
          }}
        >
          {loading ? 'Granting...' : 'Grant access'}
        </button>
      ) : (
        <span style={{ fontSize: '11px', color: '#b0b0b0', fontWeight: 600, flexShrink: 0 }}>Waiting...</span>
      )}
    </div>
  );
}
