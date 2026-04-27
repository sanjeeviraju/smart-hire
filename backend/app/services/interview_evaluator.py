import base64
import json
import re
from statistics import mean
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import get_settings


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _safe_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ''


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9']+", text.lower())


def _strip_json_fence(text: str) -> str:
    trimmed = text.strip()
    if trimmed.startswith('```'):
        trimmed = re.sub(r'^```[a-zA-Z]*\s*', '', trimmed)
        trimmed = re.sub(r'\s*```$', '', trimmed)
    return trimmed.strip()


def _gemini_call_json(model: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}'
    request = Request(
        url=url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    try:
        with urlopen(request, timeout=45) as response:
            raw = response.read().decode('utf-8')
    except (HTTPError, URLError, TimeoutError):
        return None

    try:
        body = json.loads(raw)
        text = body['candidates'][0]['content']['parts'][0]['text']
        return json.loads(_strip_json_fence(text))
    except Exception:
        return None


def transcribe_audio_bytes(audio_bytes: bytes, mime_type: str = 'audio/webm') -> str:
    settings = get_settings()
    if not audio_bytes or not settings.gemini_api_key or not settings.gemini_transcription_model:
        return ''

    payload = {
        'contents': [
            {
                'role': 'user',
                'parts': [
                    {
                        'text': (
                            'Transcribe this interview audio. Return only JSON with shape '
                            '{"transcript":"..."} and no extra keys.'
                        )
                    },
                    {'inlineData': {'mimeType': mime_type, 'data': base64.b64encode(audio_bytes).decode('utf-8')}},
                ],
            }
        ],
        'generationConfig': {'responseMimeType': 'application/json'},
    }

    data = _gemini_call_json(settings.gemini_transcription_model, payload)
    if not isinstance(data, dict):
        return ''
    return _safe_text(data.get('transcript'))


def _local_per_answer_score(
    *,
    question_type: str,
    question_text: str,
    answer_text: str,
    required_skills: list[str],
    jd_description: str,
) -> dict[str, Any]:
    answer_tokens = _tokenize(answer_text)
    question_tokens = set(_tokenize(question_text))
    jd_tokens = set(_tokenize(jd_description))
    answer_token_set = set(answer_tokens)

    word_count = len(answer_tokens)
    if word_count == 0:
        return {
            'score': 0.0,
            'feedback_text': 'No answer content provided.',
            'strengths': [],
            'improvements': ['Provide a complete response with examples and outcomes.'],
            'communication_rating': 1,
            'technical_accuracy_rating': 1,
        }

    relevance_hits = len(answer_token_set.intersection(question_tokens.union(jd_tokens)))
    skill_hits = 0
    for skill in required_skills:
        s = skill.lower().strip()
        if s and s in answer_text.lower():
            skill_hits += 1

    star_markers = ['situation', 'task', 'action', 'result']
    star_hits = sum(1 for marker in star_markers if marker in answer_text.lower())

    depth_component = _clamp((word_count / 140.0) * 5.0, 0.0, 5.0)
    relevance_component = _clamp(relevance_hits / 25.0, 0.0, 2.0)
    technical_component = _clamp(skill_hits * 0.7, 0.0, 2.0)
    behavioral_bonus = 1.0 if question_type in {'behavioral', 'personality'} and star_hits >= 2 else 0.0

    score = round(_clamp(depth_component + relevance_component + technical_component + behavioral_bonus, 0.0, 10.0), 1)
    communication_rating = int(round(_clamp(1.0 + (word_count / 45.0), 1.0, 5.0)))
    technical_rating = int(round(_clamp(1.0 + skill_hits, 1.0, 5.0)))

    strengths: list[str] = []
    improvements: list[str] = []

    if word_count >= 80:
        strengths.append('Provided a detailed and structured response.')
    else:
        improvements.append('Add more detail to explain your approach and outcome.')

    if skill_hits > 0:
        strengths.append('Referenced relevant technical skills from the role.')
    else:
        improvements.append('Include role-specific technical examples.')

    if question_type in {'behavioral', 'personality'} and star_hits >= 2:
        strengths.append('Used a clear STAR-style explanation.')
    elif question_type in {'behavioral', 'personality'}:
        improvements.append('Use STAR format (Situation, Task, Action, Result) for clarity.')

    if not strengths:
        strengths.append('Answer addressed the question context.')

    feedback_text = (
        'Strong response with clear relevance.'
        if score >= 7
        else 'Moderate response; clarity and depth can be improved.'
        if score >= 4
        else 'Response needs more structure, technical detail, and specificity.'
    )

    return {
        'score': score,
        'feedback_text': feedback_text,
        'strengths': strengths[:3],
        'improvements': improvements[:3],
        'communication_rating': communication_rating,
        'technical_accuracy_rating': technical_rating,
    }


def _build_local_analysis(
    *,
    jd_title: str,
    jd_description: str,
    required_skills: list[str],
    answers: list[dict[str, Any]],
) -> dict[str, Any]:
    per_answer: list[dict[str, Any]] = []
    technical_types = {'jd_based', 'project_based', 'scenario'}
    behavioral_types = {'behavioral', 'personality'}

    for answer in answers:
        question_index = int(answer.get('question_index', 0) or 0)
        question_type = _safe_text(answer.get('question_type')) or 'general'
        question_text = _safe_text(answer.get('question_text'))
        answer_text = _safe_text(answer.get('answer_text'))

        scored = _local_per_answer_score(
            question_type=question_type,
            question_text=question_text,
            answer_text=answer_text,
            required_skills=required_skills,
            jd_description=jd_description,
        )

        per_answer.append(
            {
                'question_index': question_index,
                'score': float(scored['score']),
                'feedback_text': scored['feedback_text'],
                'strengths': scored['strengths'],
                'improvements': scored['improvements'],
                'communication_rating': int(scored['communication_rating']),
                'technical_accuracy_rating': int(scored['technical_accuracy_rating']),
                'question_type': question_type,
            }
        )

    if not per_answer:
        return {
            'per_answer': [],
            'summary': {
                'total_score': 0.0,
                'technical_score': 0.0,
                'communication_score': 0.0,
                'behavioral_score': 0.0,
                'confidence_score': 0.0,
                'recommendation': 'Not Recommended',
                'key_strengths': [],
                'key_concerns': ['No answers submitted'],
                'cultural_fit_assessment': 'Insufficient data to assess cultural fit.',
                'narrative_analysis': 'Interview data is incomplete; unable to evaluate candidate readiness.',
                'hire_recommendation_reason': 'No interview content was available for assessment.',
            },
        }

    score_by_type = {}
    comm_scores: list[float] = []
    tech_ratings: list[float] = []
    all_scores: list[float] = []
    strengths_counter: dict[str, int] = {}
    concerns_counter: dict[str, int] = {}
    answer_lengths: list[int] = []

    for item in per_answer:
        q_type = item['question_type']
        score_by_type.setdefault(q_type, []).append(float(item['score']) * 10.0)
        comm_scores.append(float(item['communication_rating']) * 20.0)
        tech_ratings.append(float(item['technical_accuracy_rating']) * 20.0)
        all_scores.append(float(item['score']) * 10.0)
        answer_lengths.append(int(item['score'] * 14))
        for s in item['strengths']:
            strengths_counter[s] = strengths_counter.get(s, 0) + 1
        for i in item['improvements']:
            concerns_counter[i] = concerns_counter.get(i, 0) + 1

    def _avg(values: list[float]) -> float:
        return round(mean(values), 1) if values else 0.0

    technical_pool: list[float] = []
    behavioral_pool: list[float] = []
    for q_type, values in score_by_type.items():
        if q_type in technical_types:
            technical_pool.extend(values)
        if q_type in behavioral_types:
            behavioral_pool.extend(values)

    technical_score = _avg(technical_pool if technical_pool else all_scores)
    communication_score = _avg(comm_scores)
    behavioral_score = _avg(behavioral_pool if behavioral_pool else all_scores)
    confidence_score = round(_clamp((_avg(answer_lengths) / 140.0) * 100.0, 0.0, 100.0), 1)

    total_score = round(
        (technical_score * 0.35)
        + (communication_score * 0.25)
        + (behavioral_score * 0.25)
        + (confidence_score * 0.15),
        1,
    )

    recommendation = (
        'Highly Recommended'
        if total_score >= 85
        else 'Recommended'
        if total_score >= 70
        else 'Neutral'
        if total_score >= 55
        else 'Not Recommended'
    )

    key_strengths = [k for k, _ in sorted(strengths_counter.items(), key=lambda x: x[1], reverse=True)[:4]]
    key_concerns = [k for k, _ in sorted(concerns_counter.items(), key=lambda x: x[1], reverse=True)[:4]]

    narrative_analysis = (
        f'The candidate completed the interview for {jd_title} with a total score of {total_score:.1f}/100. '
        f'Technical performance was {technical_score:.1f}/100, communication was {communication_score:.1f}/100, and behavioral readiness was {behavioral_score:.1f}/100. '
        'Responses were assessed for clarity, relevance to job requirements, and practical depth. '
        'Overall fit indicates strengths in core response quality, with improvement opportunities in weaker dimensions. '
        f'Final recommendation is {recommendation}.'
    )

    return {
        'per_answer': per_answer,
        'summary': {
            'total_score': total_score,
            'technical_score': technical_score,
            'communication_score': communication_score,
            'behavioral_score': behavioral_score,
            'confidence_score': confidence_score,
            'recommendation': recommendation,
            'key_strengths': key_strengths,
            'key_concerns': key_concerns,
            'cultural_fit_assessment': 'Candidate demonstrates workable alignment with role expectations based on interview evidence.',
            'narrative_analysis': narrative_analysis,
            'hire_recommendation_reason': f'Recommendation determined from weighted technical, communication, behavioral, and confidence metrics ({total_score:.1f}/100).',
        },
    }


def _evaluate_with_gemini(
    *,
    candidate: Any,
    jd: Any,
    answers: list[dict[str, Any]],
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.gemini_api_key or not settings.gemini_analysis_model:
        return None

    payload = {
        'contents': [
            {
                'role': 'user',
                'parts': [
                    {
                        'text': (
                            'You are an interview evaluator. Return ONLY valid JSON with this schema: '
                            '{"per_answer":[{"question_index":1,"score":0-10,"feedback_text":"...","strengths":["..."],'
                            '"improvements":["..."],"communication_rating":1-5,"technical_accuracy_rating":1-5}],'
                            '"summary":{"total_score":0-100,"technical_score":0-100,"communication_score":0-100,'
                            '"behavioral_score":0-100,"confidence_score":0-100,"recommendation":"Highly Recommended|Recommended|Neutral|Not Recommended",'
                            '"key_strengths":["..."],"key_concerns":["..."],"cultural_fit_assessment":"...",'
                            '"narrative_analysis":"4-6 sentences","hire_recommendation_reason":"..."}}. '
                            f'Candidate: {getattr(candidate, "full_name", "Candidate")}. '
                            f'Role: {getattr(jd, "title", "Role")}. '
                            f'Required Skills: {json.dumps(getattr(jd, "required_skills", []) or [])}. '
                            f'JD Description: {getattr(jd, "description", "")}. '
                            f'Interview Answers: {json.dumps(answers)}'
                        )
                    }
                ],
            }
        ],
        'generationConfig': {'responseMimeType': 'application/json'},
    }

    data = _gemini_call_json(settings.gemini_analysis_model, payload)
    if not isinstance(data, dict):
        return None
    if not isinstance(data.get('per_answer'), list) or not isinstance(data.get('summary'), dict):
        return None
    return data


def evaluate_interview(candidate: Any, jd: Any, answers: list[dict[str, Any]]) -> dict[str, Any]:
    gemini_result = _evaluate_with_gemini(candidate=candidate, jd=jd, answers=answers)
    if gemini_result is not None:
        return gemini_result

    return _build_local_analysis(
        jd_title=_safe_text(getattr(jd, 'title', 'Role')),
        jd_description=_safe_text(getattr(jd, 'description', '')),
        required_skills=list(getattr(jd, 'required_skills', []) or []),
        answers=answers,
    )
