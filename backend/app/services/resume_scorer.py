from functools import lru_cache
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

EDU_LEVELS = {
    'High School': 1,
    'Diploma': 2,
    "Bachelor's": 3,
    "Master's": 4,
    'PhD': 5,
    'Unknown': 0,
}


@lru_cache
def get_encoder() -> SentenceTransformer:
    return SentenceTransformer('all-MiniLM-L6-v2')


def semantic_score(jd_text: str, resume_text: str) -> float:
    model = get_encoder()
    emb = model.encode([jd_text, resume_text])
    sim = float(cosine_similarity([emb[0]], [emb[1]])[0][0])
    scaled = ((sim + 1.0) / 2.0) * 100.0
    return float(np.clip(scaled, 0.0, 100.0))


def skills_score(candidate_skills: list[str], required: list[str], preferred: list[str]) -> tuple[float, list[str], list[str]]:
    have = {s.strip().lower() for s in candidate_skills if s.strip()}
    req = [s.strip().lower() for s in required if s.strip()]
    pref = [s.strip().lower() for s in preferred if s.strip()]

    req_matched = [s for s in req if s in have]
    pref_matched = [s for s in pref if s in have]
    req_ratio = (len(req_matched) / len(req)) if req else 1.0
    pref_ratio = (len(pref_matched) / len(pref)) if pref else 1.0

    score = ((req_ratio * 0.8) + (pref_ratio * 0.2)) * 100.0
    missing = [s for s in req if s not in have]
    return float(np.clip(score, 0.0, 100.0)), req_matched, missing


def experience_score(candidate_years: float, min_years: float, max_years: float | None) -> float:
    if candidate_years >= min_years and (max_years is None or candidate_years <= max_years):
        return 100.0

    if candidate_years < min_years:
        gap = min_years - candidate_years
        penalty = min(gap * 15.0, 100.0)
        return float(np.clip(100.0 - penalty, 0.0, 100.0))

    over = candidate_years - (max_years or candidate_years)
    penalty = min(over * 5.0, 40.0)
    return float(np.clip(100.0 - penalty, 0.0, 100.0))


def education_score(candidate_edu: str, required_edu: str) -> float:
    c = EDU_LEVELS.get(candidate_edu, 0)
    r = EDU_LEVELS.get(required_edu, 0)
    if r == 0:
        return 100.0
    if c >= r:
        return 100.0
    gap = r - c
    return float(np.clip(100.0 - (gap * 30.0), 0.0, 100.0))


def build_summary(overall: float, skills_missing: list[str], passed: bool) -> str:
    verdict = 'passes' if passed else 'does not pass'
    if skills_missing:
        top_missing = ', '.join(skills_missing[:4])
        return f'Candidate {verdict} threshold with score {overall:.1f}. Missing key skills: {top_missing}.'
    return f'Candidate {verdict} threshold with score {overall:.1f}. Skill alignment is strong.'


def score_resume(candidate: Any, jd: Any) -> dict:
    sem = semantic_score(jd.description, candidate.resume_text)
    skl, matched, missing = skills_score(candidate.extracted_skills or [], jd.required_skills or [], jd.preferred_skills or [])
    exp = experience_score(candidate.extracted_experience_years or 0.0, jd.min_experience_years or 0.0, jd.max_experience_years)
    edu = education_score(candidate.extracted_education or 'Unknown', jd.education_requirement or "Bachelor's")

    overall = (sem * 0.40) + (skl * 0.30) + (exp * 0.20) + (edu * 0.10)
    passed = overall >= float(jd.screening_threshold or 0)

    breakdown = {
        'semantic_weight': 0.40,
        'skills_weight': 0.30,
        'experience_weight': 0.20,
        'education_weight': 0.10,
        'semantic_raw': sem,
        'skills_raw': skl,
        'experience_raw': exp,
        'education_raw': edu,
    }

    return {
        'overall_score': round(overall, 2),
        'semantic_score': round(sem, 2),
        'skills_score': round(skl, 2),
        'experience_score': round(exp, 2),
        'education_score': round(edu, 2),
        'skills_matched': matched,
        'skills_missing': missing,
        'score_breakdown': breakdown,
        'ai_summary': build_summary(overall, missing, passed),
        'passed_threshold': passed,
    }
