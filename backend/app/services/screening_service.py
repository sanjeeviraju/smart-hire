import logging
import re

from sqlalchemy.orm import Session

from app.models.candidate import Candidate, CandidateStatus, ensure_candidate_selection_column
from app.models.job_description import JobDescription
from app.models.resume_score import ResumeScore

logger = logging.getLogger(__name__)

IMPORTANCE_MULTIPLIERS = {
    1: 0.5,
    2: 1.0,
    3: 1.5,
    4: 2.0,
    5: 3.0,
}


def extract_jd_keywords(description: str, required_skills: list[str]) -> list[str]:
    """
    Extract meaningful keywords from JD description and required skills.
    No LLM used.
    """
    stopwords = {
        'with', 'and', 'the', 'for', 'that', 'this',
        'from', 'will', 'have', 'strong', 'experience',
        'using', 'such', 'including', 'able', 'must',
        'work', 'team', 'good', 'knowledge', 'skill',
        'skills', 'ability', 'understanding', 'solid',
        'excellent', 'proven', 'looking', 'candidate',
        'join', 'seeking', 'degree', 'minimum', 'years',
        'least', 'more', 'also', 'well', 'into', 'both',
        'their', 'other', 'build', 'help', 'provide',
    }

    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9+#.\-]{2,}\b', (description or '').lower())
    desc_keywords = [word for word in words if word not in stopwords]

    skill_keywords: list[str] = []
    for skill in required_skills or []:
        parts = re.findall(r'\b[a-zA-Z][a-zA-Z0-9+#.\-]{2,}\b', skill.lower())
        skill_keywords.extend(parts)

    all_keywords = list(dict.fromkeys(skill_keywords + desc_keywords))
    return all_keywords[:40]


def skills_match(jd_skill: str, cand_skills: list[str]) -> bool:
    """
    Returns True if jd_skill matches any candidate skill.
    Handles: case insensitive, substrings, abbreviations.
    """
    jd_lower = jd_skill.lower().strip()

    for candidate_skill in cand_skills:
        cs_lower = candidate_skill.lower().strip()

        if jd_lower == cs_lower:
            return True

        if jd_lower in cs_lower:
            return True

        if cs_lower in jd_lower:
            return True

        cs_parts = [part.strip() for part in re.split(r'[,/|]', cs_lower)]
        if any(jd_lower == part or jd_lower in part for part in cs_parts):
            return True

    return False


def score_candidate(
    candidate: Candidate,
    jd: JobDescription,
    skill_importance: int = 4,
    exp_importance: int = 3,
    edu_importance: int = 2,
    project_importance: int = 2,
    active_skills: list[str] | None = None,
) -> dict:
    """
    Pure rule-based scoring. Zero LLM calls.
    Deterministic - same inputs always produce same output.
    """
    w_skill = IMPORTANCE_MULTIPLIERS.get(skill_importance, 2.0)
    w_exp = IMPORTANCE_MULTIPLIERS.get(exp_importance, 1.5)
    w_edu = IMPORTANCE_MULTIPLIERS.get(edu_importance, 1.0)
    w_project = IMPORTANCE_MULTIPLIERS.get(project_importance, 1.0)

    if (
        skill_importance == 4
        and exp_importance == 3
        and edu_importance == 2
        and project_importance == 2
    ):
        # Preserve legacy behavior for the default configuration.
        w_skill, w_exp, w_edu, w_project = 0.40, 0.30, 0.20, 0.10
    else:
        total_w = w_skill + w_exp + w_edu + w_project
        w_skill /= total_w
        w_exp /= total_w
        w_edu /= total_w
        w_project /= total_w

    logger.info(
        f"[SCORE] Normalized weights -> "
        f"skill={w_skill:.2f} exp={w_exp:.2f} "
        f"edu={w_edu:.2f} project={w_project:.2f}"
    )

    skills_to_use = active_skills if active_skills is not None else (jd.required_skills or [])
    jd_skills = [skill.lower().strip() for skill in skills_to_use if skill and skill.strip()]
    cand_skills = [skill.lower().strip() for skill in (candidate.extracted_skills or []) if skill and skill.strip()]

    logger.info(f"[SCORE] JD skills ({len(jd_skills)}): {jd_skills}")
    logger.info(f"[SCORE] Cand skills ({len(cand_skills)}): {cand_skills}")

    if not jd_skills:
        skill_score = 100.0
        matched_skills: list[str] = []
        missing_skills: list[str] = []
    else:
        matched_skills = [skill for skill in jd_skills if skills_match(skill, cand_skills)]
        missing_skills = [skill for skill in jd_skills if not skills_match(skill, cand_skills)]
        logger.info(f"[SCORE] Matched: {matched_skills}")
        logger.info(f"[SCORE] Missing: {missing_skills}")
        skill_score = (len(matched_skills) / len(jd_skills)) * 100.0

    min_exp = float(jd.min_experience_years or 0)
    cand_exp = float(candidate.extracted_experience_years or 0)

    if min_exp == 0:
        exp_score = 100.0
    elif cand_exp >= min_exp:
        exp_score = 100.0
    elif cand_exp >= min_exp * 0.75:
        exp_score = 75.0
    elif cand_exp >= min_exp * 0.5:
        exp_score = 50.0
    elif cand_exp > 0:
        exp_score = 25.0
    else:
        exp_score = 0.0

    edu_rank = {
        'PHD': 5,
        'MASTER': 4,
        'BACHELOR': 3,
        'ASSOCIATE': 2,
        'HIGH_SCHOOL': 1,
        'OTHER': 1,
    }
    required_edu = _normalize_education(jd.education_requirement)
    cand_edu = _normalize_education(candidate.extracted_education)

    required_rank = edu_rank.get(required_edu, 3)
    cand_rank = edu_rank.get(cand_edu, 1)

    if cand_rank >= required_rank:
        edu_score = 100.0
    elif cand_rank == required_rank - 1:
        edu_score = 60.0
    elif cand_rank == required_rank - 2:
        edu_score = 30.0
    else:
        edu_score = 10.0

    jd_keywords = extract_jd_keywords(jd.description, skills_to_use)
    search_text = ' '.join(filter(None, [_projects_to_text(candidate.extracted_projects), candidate.resume_text or ''])).lower()

    if not jd_keywords:
        project_score = 50.0
    else:
        hits = sum(1 for keyword in jd_keywords if keyword in search_text)
        project_score = min(hits / len(jd_keywords), 1.0) * 100.0

    overall = (
        skill_score * w_skill +
        exp_score * w_exp +
        edu_score * w_edu +
        project_score * w_project
    )
    overall = round(overall, 1)
    passed = overall >= float(jd.screening_threshold or 60)

    return {
        'skill_score': round(skill_score, 1),
        'exp_score': round(exp_score, 1),
        'edu_score': round(edu_score, 1),
        'project_score': round(project_score, 1),
        'overall_score': overall,
        'passed': passed,
        'matched_skills': matched_skills,
        'missing_skills': missing_skills,
    }


def run_screening_for_candidates(
    db: Session,
    jd_id: int,
    candidate_ids: list[int],
    skill_importance: int = 4,
    exp_importance: int = 3,
    edu_importance: int = 2,
    project_importance: int = 2,
    active_skills: list[str] | None = None,
    threshold: float | None = None,
) -> list[dict]:
    """
    Run scoring for a list of candidate IDs under a JD.
    Upserts ResumeScore rows and updates candidate status to Screened.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if jd is None:
        raise ValueError(f'JD {jd_id} not found')

    ensure_candidate_selection_column(db)

    results: list[dict] = []

    for candidate_id in candidate_ids:
        candidate = (
            db.query(Candidate)
            .filter(Candidate.id == candidate_id, Candidate.job_description_id == jd_id)
            .first()
        )
        if candidate is None:
            continue

        scores = score_candidate(
            candidate,
            jd,
            skill_importance=skill_importance,
            exp_importance=exp_importance,
            edu_importance=edu_importance,
            project_importance=project_importance,
            active_skills=active_skills,
        )
        effective_threshold = threshold if threshold is not None else float(jd.screening_threshold or 60)
        passed = scores['overall_score'] >= effective_threshold
        scores['passed'] = passed
        score_row = (
            db.query(ResumeScore)
            .filter(ResumeScore.candidate_id == candidate_id, ResumeScore.jd_id == jd_id)
            .first()
        )

        if score_row is None:
            score_row = ResumeScore(candidate_id=candidate_id, jd_id=jd_id, **scores)
            db.add(score_row)
        else:
            for key, value in scores.items():
                setattr(score_row, key, value)

        candidate.status = CandidateStatus.SHORTLISTED if passed else CandidateStatus.SCREENED
        if passed:
            logger.info(
                f"[SCREENING] {candidate.full_name} passed "
                f"({scores['overall_score']} >= {effective_threshold}) "
                f"-> auto-shortlisted"
            )
        else:
            logger.info(
                f"[SCREENING] {candidate.full_name} failed "
                f"({scores['overall_score']} < {effective_threshold})"
            )

        results.append({
            'candidate_id': candidate_id,
            'candidate_name': candidate.full_name,
            **scores,
        })

    db.commit()
    return results


def _normalize_education(value: str | None) -> str:
    normalized = (value or 'OTHER').strip().upper().replace("'", '').replace(' ', '_')
    mapping = {
        'BACHELORS': 'BACHELOR',
        'BACHELOR': 'BACHELOR',
        'MASTERS': 'MASTER',
        'MASTER': 'MASTER',
        'PHD': 'PHD',
        'DIPLOMA': 'ASSOCIATE',
        'ASSOCIATE': 'ASSOCIATE',
        'HIGH_SCHOOL': 'HIGH_SCHOOL',
        'HIGHSCHOOL': 'HIGH_SCHOOL',
        'UNKNOWN': 'OTHER',
        'ANY': 'OTHER',
        'OTHER': 'OTHER',
    }
    return mapping.get(normalized, 'OTHER')


def _projects_to_text(projects: list[dict] | None) -> str:
    if not projects:
        return ''

    chunks: list[str] = []
    for project in projects:
        if isinstance(project, str):
            chunks.append(project)
            continue
        title = str(project.get('title') or '').strip()
        description = str(project.get('description') or '').strip()
        if title:
            chunks.append(title)
        if description:
            chunks.append(description)
    return ' '.join(chunks)
