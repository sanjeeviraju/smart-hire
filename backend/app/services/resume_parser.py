import io
import json
import logging
import re
from functools import lru_cache

import spacy
from docx import Document
from spacy.language import Language

from app.services.ocr_engine import extract_text_from_pdf

logger = logging.getLogger(__name__)

OLLAMA_MODEL = "qwen2.5:3b"
_spacy_nlp: Language | None = None


def get_spacy_nlp() -> Language | None:
    global _spacy_nlp
    if _spacy_nlp is None:
        try:
            _spacy_nlp = spacy.load("en_core_web_trf")
            logger.info("[spaCy] en_core_web_trf loaded")
        except OSError:
            logger.warning(
                "[spaCy] en_core_web_trf not found. "
                "Run: python -m spacy download en_core_web_trf"
            )
            _spacy_nlp = None
    return _spacy_nlp


@lru_cache(maxsize=1)
def get_nlp():
    nlp = get_spacy_nlp()
    if nlp is None:
        raise ImportError("Run: python -m spacy download en_core_web_trf")
    return nlp


SECTION_HEADERS = {
    "about me", "about", "summary", "objective", "career objective",
    "professional summary", "profile", "personal profile",
    "skills", "technical skills", "key skills", "core skills",
    "soft skills", "hard skills", "tools", "technologies",
    "experience", "work experience", "professional experience",
    "employment", "employment history", "work history",
    "education", "educational background", "academic background",
    "qualifications", "academic qualifications",
    "projects", "key projects", "personal projects",
    "certifications", "certificates", "courses", "training",
    "languages", "programming languages", "spoken languages",
    "interests", "hobbies", "extracurricular", "activities",
    "references", "referees",
    "contact", "contact information", "contact details",
    "personal", "personal details", "personal information",
    "declaration", "achievements", "awards", "honors", "honours",
    "publications", "research", "volunteer", "volunteering",
    "internship", "internships", "career", "career summary",
    "technical expertise", "areas of expertise",
    "strengths", "highlights", "responsibilities",
}

BAD_NAME_WORDS = {
    "python", "java", "javascript", "typescript", "sql", "html", "css",
    "react", "node", "django", "flask", "fastapi", "spring", "angular",
    "engineer", "developer", "manager", "intern", "analyst", "designer",
    "consultant", "architect", "lead", "senior", "junior", "associate",
    "contact", "email", "phone", "mobile", "address", "linkedin",
    "github", "portfolio", "resume", "cv", "curriculum", "vitae",
    "skills", "about", "summary", "objective", "profile",
    "bachelor", "master", "degree", "university", "college",
    "institute", "school", "academy", "gpa", "cgpa", "grade",
    "india", "usa", "uk", "bangalore", "chennai", "mumbai", "delhi",
    "hyderabad", "pune", "kerala", "tamil", "nadu", "tuticorin",
    "coimbatore", "madurai", "trichy", "salem", "vellore",
    "present", "current", "date", "birth", "nationality", "dob",
    "gender", "male", "female", "married", "single",
    "the", "and", "for", "with", "from",
    "b.tech", "btech", "m.tech", "mtech", "bsc", "msc", "bca",
    "10th", "12th", "ssc", "hsc",
    "i", "me", "my", "myself", "a", "an", "the",
    "consider", "am", "is", "are", "was", "were",
    "have", "has", "had", "be", "been", "being",
    "will", "would", "could", "should", "shall",
    "this", "that", "these", "those", "it", "its",
    "we", "our", "you", "your", "he", "she", "they",
    "his", "her", "their", "who", "which", "what",
    "when", "where", "why", "how", "all", "any",
    "also", "such", "each", "every", "both", "few",
    "seeking", "looking", "working", "passionate",
    "motivated", "dedicated", "experienced", "skilled",
    "proficient", "responsible", "hardworking",
    "enthusiastic", "dynamic", "self", "driven",
    "results", "oriented", "focused", "based",
}

ORG_SUFFIXES = {
    "university", "college", "institute", "school", "academy",
    "technologies", "solutions", "services", "systems", "labs",
    "pvt", "ltd", "llc", "inc", "corp", "limited", "co.",
    "foundation", "trust", "association", "society",
    "hospital", "clinic", "center", "centre",
    "india", "usa", "uk", "international",
}

SKILLS_KEYWORDS = [
    "python", "java", "javascript", "typescript", "react", "vue", "angular",
    "node", "express", "fastapi", "django", "flask", "sql", "postgresql",
    "mysql", "mongodb", "redis", "elasticsearch", "docker", "kubernetes",
    "aws", "gcp", "azure", "terraform", "git", "linux", "bash", "c++",
    "c#", "rust", "go", "swift", "kotlin", "machine learning", "deep learning",
    "nlp", "computer vision", "pytorch", "tensorflow", "scikit-learn",
    "pandas", "numpy", "spark", "kafka", "airflow", "graphql", "rest api",
    "microservices", "figma", "tailwind", "spring boot", "hibernate",
    "opencv", "yolo", "transformers", "huggingface", "langchain",
    "llm", "rag", "vector database", "pinecone", "weaviate", "fastapi",
    "celery", "rabbitmq", "supabase", "firebase",
]

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}")
PHONE_PATTERN = re.compile(r"(?<!\d)(\+?[\d][\d\s\-().]{8,14}[\d])(?!\d)")
PROJECT_PATTERN = re.compile(
    r"(projects?|personal projects?|key projects?|notable projects?|academic projects?)"
    r"(.*?)"
    r"(experience|education|skills|certifications|awards|references|declaration|$)",
    flags=re.IGNORECASE | re.DOTALL,
)


def _extract_text_from_docx(docx_bytes: bytes) -> str:
    document = Document(io.BytesIO(docx_bytes))
    return "\n".join(paragraph.text for paragraph in document.paragraphs).strip()


def _normalize(value: str) -> str:
    return value.lower().strip(".:")


def _extract_skills_section(text: str) -> str:
    lines = text.splitlines()
    capture = False
    collected: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if capture and collected:
                break
            continue

        normalized = stripped.lower().strip(".:|-–— ")
        if normalized in {"skills", "technical skills", "key skills", "core skills", "tools", "technologies"}:
            capture = True
            continue

        if capture:
            if normalized in SECTION_HEADERS:
                break
            collected.append(stripped)

    return "\n".join(collected)


def _project_payload(projects_text: str) -> list[dict]:
    if not projects_text:
        return []

    lines = [line.strip(" -\t") for line in projects_text.splitlines() if line.strip()]
    if not lines:
        return [{"title": "Project Highlights", "description": projects_text[:1000]}]

    payload: list[dict] = []
    for index, line in enumerate(lines[:8], start=1):
        numbered = re.match(r"^\d+[.)]\s+(.+)$", line)
        if numbered:
            payload.append({"title": numbered.group(1).strip()[:300], "description": ""})
        else:
            payload.append({"title": f"Project {index}", "description": line[:300]})
    return payload


def is_likely_org(text: str) -> bool:
    stripped = text.strip()
    words = stripped.lower().split()
    if any(word in ORG_SUFFIXES for word in words):
        return True
    if "," in stripped:
        return True
    if len(stripped.split()) > 5:
        return True
    if any(char.isdigit() for char in stripped):
        return True
    if stripped.startswith("The ") and len(stripped.split()) >= 3:
        return True
    return False


def is_valid_name(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if _normalize(stripped) in SECTION_HEADERS:
        return False
    if ":" in stripped:
        return False
    if "@" in stripped:
        return False
    if any(char.isdigit() for char in stripped):
        return False
    if "/" in stripped:
        return False
    if "http" in stripped.lower():
        return False
    if len(stripped) > 50:
        return False

    words = stripped.split()
    if len(words) < 2 or len(words) > 4:
        return False
    first_word = words[0].lower()
    if first_word in {"i", "a", "an", "the", "my", "our", "this", "that", "it", "we", "you"}:
        return False
    if any(word.lower() in BAD_NAME_WORDS for word in words):
        return False
    if any(word.lower() in SECTION_HEADERS for word in words):
        return False
    if is_likely_org(stripped):
        return False
    if not all(re.match(r"^[A-Za-z'-]+$", word) for word in words):
        return False
    return True


def extract_name_by_email_anchor(lines: list[str], email: str) -> str:
    email_line_idx = -1
    for index, line in enumerate(lines):
        if email.lower() in line.lower():
            email_line_idx = index
            break

    if email_line_idx == -1:
        return ""

    start = max(0, email_line_idx - 5)
    end = min(len(lines), email_line_idx + 6)
    logger.debug(f"[NAME ANCHOR] Email on line {email_line_idx}")
    logger.debug("[NAME ANCHOR] Lines near email:")
    for index, line in enumerate(lines[start:end]):
        logger.debug(f"  [{index}] {line.strip()!r}")

    for line in reversed(lines[start:email_line_idx]):
        stripped = line.strip()
        if not stripped:
            continue
        if is_valid_name(stripped):
            return stripped

        words = stripped.split()
        if all(word.isupper() and word.isalpha() for word in words) and 2 <= len(words) <= 4:
            titled = stripped.title()
            if is_valid_name(titled):
                return titled

    for line in lines[email_line_idx + 1 : end]:
        stripped = line.strip()
        if not stripped:
            continue
        if is_valid_name(stripped):
            logger.info(f"[NAME] Email anchor BELOW: {stripped!r}")
            return stripped

        words = stripped.split()
        if 2 <= len(words) <= 4 and all(word.isupper() and word.isalpha() for word in words):
            titled = stripped.title()
            if is_valid_name(titled):
                logger.info(f"[NAME] Email anchor BELOW CAPS: {titled!r}")
                return titled

    return ""


def extract_name(text: str, email: str = "") -> str:
    lines = text.splitlines()

    for line in lines[:5]:
        stripped = line.strip()
        if not stripped:
            continue

        email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", stripped)
        if not email_match:
            continue

        before_email = stripped[:email_match.start()].strip()
        before_email = re.sub(r"[|???????????/\]", " ", before_email).strip()
        candidate = before_email.strip()
        if is_valid_name(candidate):
            logger.info(f"[NAME] Stage 0 same-line: {candidate!r}")
            return candidate

        words = candidate.split()
        if 2 <= len(words) <= 4 and all(word.isupper() and word.isalpha() for word in words):
            titled = candidate.title()
            if is_valid_name(titled):
                logger.info(f"[NAME] Stage 0 same-line CAPS: {titled!r}")
                return titled

    for match in re.finditer(r"(?:full\s*)?name\s*[:\-]\s*([A-Za-z][A-Za-z\s'-]{2,40})", text[:1000], flags=re.IGNORECASE):
        candidate = match.group(1).strip()
        if is_valid_name(candidate):
            logger.info(f"[NAME] Stage 1 label: {candidate!r}")
            return candidate

    spacy_name = extract_name_spacy(text)
    if spacy_name:
        logger.info(f"[NAME] Stage 2 spaCy: {spacy_name!r}")
        return spacy_name

    if email:
        result = extract_name_by_email_anchor(lines, email)
        if result:
            logger.info(f"[NAME] Stage 3 email anchor: {result!r}")
            return result

    email_at_top = bool(email and any(email.lower() in line.lower() for line in lines[:3]))
    spacy_text = text[:2000] if email_at_top else text[:800]
    caps_scan_limit = 50 if email_at_top else 25

    nlp = get_spacy_nlp()
    if nlp is not None:
        doc = nlp(spacy_text)
        org_texts = {entity.text.lower() for entity in doc.ents if entity.label_ == "ORG"}
        for entity in doc.ents:
            if entity.label_ == "PERSON":
                candidate = entity.text.strip()
                if candidate.lower() not in org_texts and is_valid_name(candidate):
                    logger.info(f"[NAME] Stage 4 spaCy NER: {candidate!r}")
                    return candidate

    for line in lines[:caps_scan_limit]:
        stripped = line.strip()
        words = stripped.split()
        if 2 <= len(words) <= 4 and all(word.isupper() and word.isalpha() for word in words):
            candidate = stripped.title()
            if is_valid_name(candidate):
                logger.info(f"[NAME] Stage 5 ALL CAPS: {candidate!r}")
                return candidate

    for line in lines[:30]:
        stripped = line.strip()
        if is_valid_name(stripped):
            logger.info(f"[NAME] Stage 6 first valid: {stripped!r}")
            return stripped

    skip = {
        "professional overview",
        "personal statement",
        "career objective",
        "about me",
        "summary",
        "curriculum vitae",
        "contact information",
    }
    for line in lines[: len(lines) // 2]:
        stripped = line.strip()
        words = stripped.split()
        if 2 <= len(words) <= 4:
            if all(
                word[0].isupper() and word.replace('-', '').isalpha()
                for word in words
                if len(word) > 1
            ):
                if stripped.lower() not in skip:
                    logger.info(f"[NAME] Last resort scan: {stripped!r}")
                    return stripped

    logger.warning("[NAME] All stages failed - name not found")
    logger.warning("[NAME] All stages failed. First 20 lines were:")
    for index, line in enumerate(text.splitlines()[:20]):
        logger.warning(f"  [{index}] {line.strip()!r}")
    return ""

def extract_name_spacy(raw_text: str) -> str:
    """
    Extract candidate name using spaCy NER.
    Uses en_core_web_trf transformer model.
    """
    nlp = get_spacy_nlp()
    lines = raw_text.strip().splitlines()

    email_line_idx = -1
    email_pattern = re.compile(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}', re.IGNORECASE)
    for i, line in enumerate(lines):
        if email_pattern.search(line):
            email_line_idx = i
            break

    context_lines = []
    context_lines.extend(lines[:5])

    if email_line_idx >= 0:
        start = max(0, email_line_idx - 6)
        end = min(len(lines), email_line_idx + 4)
        for line in lines[start:end]:
            if line not in context_lines:
                context_lines.append(line)

    context_text = "\n".join(context_lines)

    if nlp is not None:
        try:
            doc = nlp(context_text[:1000])

            reject_words = {
                "linkedin", "github", "leetcode",
                "university", "college", "institute",
                "school", "technology", "engineering",
                "jain", "the vikasa", "navodaya",
                "professional", "overview", "india",
                "bangalore", "tuticorin", "namakal",
            }

            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    name = ent.text.strip()
                    if len(name.split()) < 2:
                        continue
                    name_lower = name.lower()
                    if any(word in name_lower for word in reject_words):
                        continue
                    if len(name.split()) > 5:
                        continue
                    if any(char.isdigit() for char in name):
                        continue

                    logger.info(f"[NAME] spaCy NER: {name!r}")
                    return name

        except Exception as e:
            logger.warning(f"[NAME] spaCy failed: {e}")

    if email_line_idx >= 0:
        search_range = range(max(0, email_line_idx - 6), min(len(lines), email_line_idx + 4))
        for i in search_range:
            line = lines[i].strip()
            words = line.split()

            if 2 <= len(words) <= 5:
                if all(w.isupper() and w.replace('-', '').isalpha() for w in words):
                    skip_headers = {
                        "SKILLS", "EDUCATION",
                        "EXPERIENCE", "PROJECTS",
                        "WORK EXPERIENCE",
                        "PROFESSIONAL OVERVIEW",
                        "CERTIFICATIONS",
                        "ACHIEVEMENTS",
                        "CONTACT", "SUMMARY",
                        "DECLARATION",
                    }
                    if line not in skip_headers:
                        logger.info(f"[NAME] ALL CAPS near email: {line!r}")
                        return line

    if email_line_idx >= 0:
        search_range = range(max(0, email_line_idx - 6), min(len(lines), email_line_idx + 4))
        for i in search_range:
            line = lines[i].strip()
            words = line.split()

            if 2 <= len(words) <= 4:
                if all(
                    w[0].isupper() and w.replace('-', '').isalpha()
                    for w in words
                    if len(w) > 1
                ):
                    skip = {
                        "Professional Overview",
                        "Personal Statement",
                        "Career Objective",
                        "About Me", "Contact Me",
                        "Work Experience",
                        "Core Skills",
                    }
                    if line not in skip:
                        logger.info(f"[NAME] Title Case near email: {line!r}")
                        return line

    section_headers = {
        "skills", "education", "experience",
        "projects", "certifications",
        "achievements", "contact", "summary",
        "overview", "declaration", "work",
        "professional", "personal", "about",
        "languages", "tools", "internship",
    }

    for line in lines[:len(lines)//2]:
        line = line.strip()
        if not line:
            continue
        words = line.split()
        if 2 <= len(words) <= 4:
            line_lower = line.lower()
            if line_lower in section_headers:
                continue
            if any(h in line_lower for h in section_headers):
                continue
            if all(
                w[0].isupper() and len(w) >= 2 and w.replace('-', '').isalpha()
                for w in words
            ):
                logger.info(f"[NAME] Full scan: {line!r}")
                return line

    logger.warning("[NAME] All strategies failed")
    return ""


def extract_email(text: str) -> str:
    """
    Extract first valid real email from text.
    Searches the ENTIRE text, not just first N lines.
    """
    pattern = re.compile(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", re.IGNORECASE)

    for match in pattern.finditer(text):
        email = match.group(0).lower().strip()

        if "example.com" in email:
            continue
        if "test.com" in email:
            continue
        if email.startswith("unknown+"):
            continue
        if "noreply" in email:
            continue

        logger.info(f"[EMAIL] Found: {email!r}")
        return email

    logger.warning("[EMAIL] No valid email found in text")
    return ""


def extract_phone(text: str) -> str:
    match = PHONE_PATTERN.search(text)
    if not match:
        return ""

    result = match.group(1).strip()
    if "\n" in result or "\r" in result:
        return ""

    result = re.sub(r"^[^\d+]+", "", result)
    result = re.sub(r"[^\d]+$", "", result)

    if result.count("(") != result.count(")"):
        result = result.replace("(", "").replace(")", "")

    digits_only = re.sub(r"\D", "", result)
    if len(digits_only) < 7 or len(digits_only) > 15:
        return ""

    return result


def extract_skills(text: str) -> list[str]:
    lower_text = text.lower()
    found = [skill for skill in SKILLS_KEYWORDS if skill in lower_text]
    institution_fragments = {
        "university", "college", "institute", "school",
        "academy", "vidyalaya", "polytechnic", "iit", "nit",
        "bits", "vit", "srm", "jain", "vikasa", "amrita",
        "icse", "cbse", "ssc", "hsc", "board", "borad",
        "matric", "syllabus",
    }

    def is_institution(skill: str) -> bool:
        words = skill.lower().split()
        return any(word in institution_fragments for word in words)

    skills_section = _extract_skills_section(text) or text[:1200]
    nlp = get_spacy_nlp()
    if nlp is None:
        return [skill for skill in dict.fromkeys(found) if not is_institution(skill)]
    doc = nlp(skills_section)
    entity_skills: list[str] = []
    for entity in doc.ents:
        if entity.label_ not in {"ORG", "PRODUCT"}:
            continue
        value = entity.text.strip()
        normalized = value.lower().strip(".:|-–— ")
        if not value or normalized in SECTION_HEADERS:
            continue
        if any(char.isdigit() for char in value):
            continue
        if len(value) > 40:
            continue
        entity_skills.append(value.lower())

    matched = list(dict.fromkeys(found + entity_skills))
    return [skill for skill in matched if not is_institution(skill)]


def extract_experience(text: str) -> float:
    education_pattern = re.compile(
        r"(b\.?tech|m\.?tech|b\.?e|b\.?sc|m\.?sc|bca|mca|"
        r"bachelor|master|phd|degree|diploma|"
        r"university|college|institute|school|"
        r"10th|12th|ssc|hsc|cgpa|gpa|semester|"
        r"first year|second year|third year|final year|"
        r"class\s*\d)",
        re.IGNORECASE,
    )

    work_keywords_pattern = re.compile(
        r"(intern|internship|trainee|work|worked|working|"
        r"employed|employment|job|position|role|"
        r"company|organisation|organization|firm|"
        r"engineer|developer|analyst|manager|consultant|"
        r"project\s+engineer|software|fullstack|backend|"
        r"frontend)",
        re.IGNORECASE,
    )

    lines = text.splitlines()
    work_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if education_pattern.search(stripped):
            continue
        if work_keywords_pattern.search(stripped):
            work_lines.append(stripped)

    explicit_pattern = re.compile(
        r"(\d+\.?\d*)\s*\+?\s*years?\s*(of\s*)?(experience|exp)",
        re.IGNORECASE,
    )
    match = explicit_pattern.search(text)
    if match:
        value = float(match.group(1))
        if 0.5 <= value <= 30.0:
            logger.info(f"[EXP] Explicit mention: {value}")
            return value

    date_pattern = re.compile(
        r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)"
        r"[a-z]*\.?\s*)?"
        r"(20\d{2}|19[89]\d)"
        r"\s*[-–—to/]+\s*"
        r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)"
        r"[a-z]*\.?\s*)?"
        r"(20\d{2}|19[89]\d|present|current|now)",
        re.IGNORECASE,
    )

    single_pattern = re.compile(
        r"[\[\(]?\s*(?:on-site\s*\|\s*|remote\s*\|\s*|hybrid\s*\|\s*)?"
        r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+"
        r"(20\d{2}|19[89]\d)\s*[\]\)]?",
        re.IGNORECASE,
    )

    total_months = 0
    seen_ranges = set()
    work_text = "\n".join(work_lines)

    for match in date_pattern.finditer(work_text):
        start_year = int(match.group(2))
        end_raw = match.group(4).lower()
        end_year = 2025 if end_raw in ("present", "current", "now") else int(end_raw)

        if start_year < 1990 or start_year > 2025:
            continue
        if end_year > 2025 or end_year < start_year:
            continue
        diff_years = end_year - start_year
        if diff_years > 15:
            continue

        range_key = (start_year, end_year)
        if range_key in seen_ranges:
            continue
        seen_ranges.add(range_key)
        total_months += diff_years * 12

    if single_pattern.search(work_text):
        logger.info("[EXP] Single-month work entry found. Returning 0.0")
        return 0.0

    if total_months > 0:
        if total_months < 2:
            logger.info(f"[EXP] Total duration {total_months} month(s) < 2. Returning 0.0")
            return 0.0
        result = round(total_months / 12, 1)
        result = min(result, 30.0)
        logger.info(f"[EXP] Date ranges from work lines: {result}")
        return result

    logger.info("[EXP] No parseable work dates found. Returning 0.0")
    return 0.0


def extract_education(text: str) -> str:
    text_lower = text.lower()

    if any(keyword in text_lower for keyword in ["ph.d", "phd", "doctorate", "doctor of philosophy"]):
        return "PHD"

    if any(
        keyword in text_lower
        for keyword in [
            "master", "m.tech", "mtech", "m. tech",
            "msc", "m.sc", "m.s.", "mba", "m.e.",
            "m.eng", "pgdm", "post graduate",
            "postgraduate", "pg diploma",
        ]
    ):
        return "MASTER"

    if any(
        keyword in text_lower
        for keyword in [
            "bachelor", "b.tech", "btech",
            "b. tech", " b tech", "b.tech.",
            "b.e.", "b.e ", " be,", "bsc",
            "b.sc", "b.s.", "undergraduate",
            "b.eng", "b.a.", "bca", "bba", "b.com",
            "bachelor of", "b.tech artificial",
            "artificial intelligence and machine",
        ]
    ):
        return "BACHELOR"

    if ("computer science engineering" in text_lower or "cse" in text_lower):
        idx = text_lower.find("computer science")
        if idx == -1:
            idx = text_lower.find("cse")
        context = text_lower[max(0, idx - 50):idx + 100]
        if any(keyword in context for keyword in [
            "b.tech", "b. tech", "bachelor",
            "engineering", "degree", "pursuing",
        ]):
            return "BACHELOR"

    for keyword in ["information technology", "it engineering"]:
        idx = text_lower.find(keyword)
        if idx != -1:
            context = text_lower[max(0, idx - 50):idx + 100]
            if any(ctx_keyword in context for ctx_keyword in [
                "b.tech", "b. tech", "bachelor",
                "engineering", "degree", "pursuing",
            ]):
                return "BACHELOR"

    if "associate" in text_lower:
        return "ASSOCIATE"

    hs_signals = [
        "high school", "hsc", "ssc",
        "higher secondary", "10+2",
    ]
    if any(keyword in text_lower for keyword in hs_signals):
        return "HIGH_SCHOOL"

    if "12th" in text_lower:
        degree_signals = [
            "b.tech", "b. tech", "bachelor",
            "b.e", "bsc", "master", "mtech",
        ]
        if not any(signal in text_lower for signal in degree_signals):
            return "HIGH_SCHOOL"

    return "OTHER"


def extract_projects(text: str) -> str:
    match = PROJECT_PATTERN.search(text)
    if match:
        return match.group(2).strip()[:1000]
    return ""


def extract_project_titles(raw_text: str) -> str:
    """
    Extract project titles from resume OCR text.
    Handles all known resume formats:
      Format A: "1. Title [date]" then bullet description
      Format B: "Bold Title," then bullet description (no numbers)
      Format C: Under explicit PROJECT/PROJECT EXPERIENCE header
    """
    import re
    titles = []
    seen = set()
    lines = raw_text.splitlines()
    bullet_chars = "•·-*►▸"

    logger.info(
        f"[PROJECTS] Starting extraction. "
        f"Text length: {len(raw_text)} chars. "
        f"Total lines: {len(raw_text.splitlines())}"
    )

    # -- HELPER -------------------------------------------------
    SECTION_HEADERS = {
        "project experience", "projects", "experience",
        "work experience", "professional experience",
        "skills", "technical skills", "education",
        "educational background", "certifications",
        "achievements", "awards", "summary", "overview",
        "contact", "references", "declaration",
        "activities", "extra curricular", "languages",
        "internships", "training", "publications",
    }
    SKIP_STARTS = (
        "designed", "developed", "built", "created",
        "implemented", "integrated", "applied", "used",
        "this ", "the ", "a ", "an ", "it ", "we ",
        "i ", "worked", "responsible", "helped",
        "•", "·", "-", "*", "►", "▸",
        "tech stack", "libraries", "tools:", "stack:",
    )

    def is_skip(line: str) -> bool:
        s = line.strip().lower()
        if not s:
            return True
        if s in SECTION_HEADERS:
            return True
        if any(s.startswith(p) for p in SKIP_STARTS):
            return True
        # Education entry check
        has_grade = any(k in s for k in
            ["cgpa", "gpa", "%", "grade", "percentage"])
        has_degree = any(k in s for k in
            ["b.tech", "btech", "b. tech", "m.tech",
             "bachelor", "master", "b.e.", "b.sc",
             "phd", "diploma"])
        has_inst = any(k in s for k in
            ["university", "college", "institute",
             "school of engineering", "iit ", "nit "])
        if has_degree and (has_grade or has_inst):
            return True
        return False

    def clean_title(t: str) -> str:
        # Remove trailing comma, period, colon
        t = t.rstrip(",.:;").strip()
        # Remove trailing date range [Nov 2024 - Dec 2024]
        t = re.sub(
            r"\s*[\[\(][A-Za-z\s\d,–\-]+[\]\)]\s*$",
            "", t
        ).strip()
        # Remove trailing date [March 2025]
        t = re.sub(
            r"\s*[\[\(][A-Za-z]+\s+\d{4}[\]\)]\s*$",
            "", t
        ).strip()
        return t

    def is_next_line_bullet(idx: int) -> bool:
        """Check if the next non-empty line after idx is a bullet."""
        for j in range(idx + 1, min(idx + 5, len(lines))):
            nl = lines[j].strip()
            if not nl:
                continue
            return nl[0] in bullet_chars
        return False

    def add_title(raw_title: str) -> bool:
        """Clean and add title if valid. Returns True if added."""
        title = clean_title(raw_title.strip())
        if len(title) < 6 or len(title) > 100:
            return False
        if title.lower() in seen:
            return False
        if is_skip(title):
            return False
        if len(title.split()) < 2:
            return False
        seen.add(title.lower())
        titles.append(title)
        return True

    # -- STRATEGY A: Find PROJECT section, extract titles --
    # Locate the start of any project section
    proj_start_idx = -1
    proj_end_idx = len(lines)

    proj_header_re = re.compile(
        r"^(PROJECT\s+EXPERIENCE|PROJECTS?|"
        r"ACADEMIC\s+PROJECTS?|KEY\s+PROJECTS?|"
        r"PERSONAL\s+PROJECTS?|MAJOR\s+PROJECTS?|"
        r"MINI\s+PROJECTS?|MY\s+PROJECTS?)$",
        re.IGNORECASE
    )
    next_section_re = re.compile(
        r"^(EDUCATION|SKILLS|TECHNICAL\s+SKILLS|"
        r"EXPERIENCE|WORK\s+EXPERIENCE|CERTIFICATIONS|"
        r"ACHIEVEMENTS|AWARDS|INTERNSHIP|TRAINING|"
        r"EXTRA|ACTIVITIES|VOLUNTEER|DECLARATION|"
        r"REFERENCES|CONTACT|SUMMARY|OBJECTIVE|PROFILE)$",
        re.IGNORECASE
    )

    for i, line in enumerate(lines):
        if proj_header_re.match(line.strip()):
            proj_start_idx = i + 1
            # Find end of section
            for j in range(i + 1, len(lines)):
                if next_section_re.match(lines[j].strip()):
                    proj_end_idx = j
                    break
            break

    if proj_start_idx >= 0:
        logger.info(
            f"[PROJECTS] Found project section at line "
            f"{proj_start_idx}, ends at {proj_end_idx}"
        )
    else:
        logger.warning(
            "[PROJECTS] No explicit project section found. "
            "Searching full document."
        )

    # If no explicit section found, search full document
    search_lines = (
        lines[proj_start_idx:proj_end_idx]
        if proj_start_idx >= 0
        else lines
    )

    # -- STRATEGY B: Numbered titles ---------------------
    num_re = re.compile(r"^(\d+)[.)]\s+(.+)")
    for i, line in enumerate(search_lines):
        m = num_re.match(line.strip())
        if m:
            add_title(m.group(2))
    logger.info(f"[PROJECTS] After Strategy B (numbered): {titles}")

    # -- STRATEGY C: Bullet-preceded titles --------------
    # A title is any line where the NEXT non-empty line is a bullet
    # Only run if Strategy B found nothing
    if not titles:
        for i, line in enumerate(search_lines):
            stripped = line.strip()
            if not stripped:
                continue
            if is_skip(stripped):
                continue
            next_is_bullet = False
            for j in range(i + 1, min(i + 5, len(search_lines))):
                nxt = search_lines[j].strip()
                if not nxt:
                    continue
                if nxt[0] in bullet_chars:
                    next_is_bullet = True
                break
            if next_is_bullet:
                add_title(stripped)
            if len(titles) >= 8:
                break
    logger.info(f"[PROJECTS] After Strategy C (bullet-preceded): {titles}")

    # -- STRATEGY D: Tech Stack anchor -------------------
    # Find "Tech Stack:" lines, title is above them
    if not titles:
        for i, line in enumerate(lines):
            if re.match(r"^\s*Tech\s*Stack\s*:", line, re.IGNORECASE):
                for j in range(i - 1, max(i - 6, -1), -1):
                    candidate = lines[j].strip()
                    if not candidate:
                        continue
                    if candidate[0] in bullet_chars:
                        continue
                    m = re.match(r"^\d+[.)]\s*(.+)", candidate)
                    if m:
                        candidate = m.group(1)
                    add_title(candidate)
                    break
    logger.info(f"[PROJECTS] After Strategy D (tech stack anchor): {titles}")

    # -- STRATEGY E: Full document scan ------------------
    # Last resort: scan full document for bullet-preceded lines
    if not titles:
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or is_skip(stripped):
                continue
            next_is_bullet = False
            for j in range(i + 1, min(i + 5, len(lines))):
                nxt = lines[j].strip()
                if not nxt:
                    continue
                if nxt[0] in bullet_chars:
                    next_is_bullet = True
                break
            if next_is_bullet:
                add_title(stripped)
            if len(titles) >= 8:
                break
    logger.info(f"[PROJECTS] After Strategy E (full scan): {titles}")

    if not titles:
        logger.warning("[PROJECTS] No project titles found")
        return ""

    # Re-number sequentially
    result = "\n".join(
        f"{i + 1}. {title}"
        for i, title in enumerate(titles[:8])
    )
    logger.info(f"[PROJECTS] Extracted: {result}")
    return result


def clean_project_titles(projects_raw: str) -> str:
    """Extract only project titles as numbered list."""
    if not projects_raw:
        return ""

    lines = projects_raw.strip().splitlines()
    titles: list[str] = []
    counter = 1
    seen: set[str] = set()

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line[0] in "•·*►▸▶":
            continue

        lower = line.lower()
        skip_starts = [
            "tech stack", "libraries:", "tools:",
            "implemented", "built a", "designed a",
            "developed a", "created a", "this project",
            "the system", "• ", "- implemented",
        ]
        if any(lower.startswith(prefix) for prefix in skip_starts):
            continue

        match = re.match(r"^(\d+)[.)]\s+(.+)", line)
        if match:
            rest = match.group(2).strip()
            rest = re.sub(
                r"\s*[\[\(][A-Za-z]*\s*\d{4}\s*[-–—]\s*[A-Za-z]*\s*\d{0,4}[\]\)]",
                "",
                rest,
            ).strip()
            rest = re.sub(r"\s*[\[\(][A-Za-z]+\s+\d{4}[\]\)]", "", rest).strip()

            if " - " in rest:
                title_part = rest.split(" - ")[0].strip()
                if 5 <= len(title_part) <= 80:
                    rest = title_part

            if 5 <= len(rest) <= 100 and rest.lower() not in seen:
                seen.add(rest.lower())
                titles.append(f"{counter}. {rest}")
                counter += 1
            continue

        match = re.match(r"^project\s*\d*[:.)\-\s]+(.+)", line, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            title = re.sub(r"\s*[\[\(][^\]\)]+[\]\)]", "", title).strip()
            if " - " in title:
                title = title.split(" - ")[0].strip()
            if 5 <= len(title) <= 100 and title.lower() not in seen:
                seen.add(title.lower())
                titles.append(f"{counter}. {title}")
                counter += 1

    if titles:
        return "\n".join(titles)

    section_headers_set = {
        "skills", "education", "experience", "projects",
        "certifications", "contact", "summary", "overview",
        "languages", "tools", "achievements", "references",
    }
    for line in lines[:30]:
        line = line.strip()
        if not line or len(line) < 5 or len(line) > 80:
            continue
        if line.lower() in section_headers_set:
            continue
        if line[0] in "•·*-":
            continue

        words = line.split()
        if len(words) >= 3 and sum(1 for word in words if word and word[0].isupper()) >= len(words) * 0.6:
            if line.lower() not in seen:
                seen.add(line.lower())
                titles.append(f"{counter}. {line}")
                counter += 1
        if counter > 6:
            break

    return "\n".join(titles)


def detect_education_from_text(text_lower: str) -> str:
    if any(k in text_lower for k in ["ph.d", "phd", "doctorate", "doctor of philosophy"]):
        return "PHD"

    if any(
        k in text_lower
        for k in [
            "master", "m.tech", "mtech", "m. tech",
            "msc", "m.sc", "m.s.", "mba", "m.e.",
            "m.eng", "pgdm", "post graduate", "postgraduate",
            "pg diploma",
        ]
    ):
        return "MASTER"

    if any(
        k in text_lower
        for k in [
            "bachelor", "b.tech", "btech", "b. tech",
            "b.e.", "be ", " be,", "bsc", "b.sc", "b.s.",
            "undergraduate", "b.eng", "b.a.", "bca",
            "bba", "b.com", "bachelor of",
        ]
    ):
        return "BACHELOR"

    if "associate" in text_lower:
        return "ASSOCIATE"

    if any(
        k in text_lower
        for k in [
            "high school", "hsc", "ssc", "secondary school",
            "10+2", "higher secondary", "matric",
            "a levels", "o levels",
        ]
    ):
        return "HIGH_SCHOOL"

    if "12th" in text_lower and not any(
        k in text_lower for k in ["b.tech", "btech", "bachelor", "b.e", "bsc", "master", "mtech", "phd"]
    ):
        return "HIGH_SCHOOL"

    return "OTHER"


def get_llm_text(raw_text: str) -> str:
    """
    Extract the most relevant text for the LLM.
    Always includes the full skills section even if it appears late.
    """
    skills_match = re.search(
        r'\n\s*(?:SKILLS?|TECHNICAL SKILLS?|CORE SKILLS?|KEY SKILLS?)\s*\n',
        raw_text,
        re.IGNORECASE,
    )

    skills_text = ""
    if skills_match:
        skills_start = skills_match.start()
        next_section = re.search(
            r'\n\s*(?:EDUCATION|EXPERIENCE|WORK|PROJECTS?|CERTIFICATIONS?|ACHIEVEMENTS?|INTERNSHIP|DECLARATION)\s*\n',
            raw_text[skills_match.end():],
            re.IGNORECASE,
        )
        if next_section:
            skills_end = skills_match.end() + next_section.start()
        else:
            skills_end = skills_match.end() + 2000
        skills_text = raw_text[skills_start:skills_end]

    header_text = raw_text[:1500]

    proj_match = re.search(
        r'\n\s*(?:PROJECTS?|ACADEMIC PROJECTS?)\s*\n',
        raw_text,
        re.IGNORECASE,
    )
    proj_text = ""
    if proj_match:
        proj_text = raw_text[proj_match.start():proj_match.start() + 800]

    combined = header_text
    if skills_text and skills_text not in combined:
        combined += "\n\n" + skills_text
    if proj_text and proj_text not in combined:
        combined += "\n\n" + proj_text[:500]

    return combined[:4000]


def clean_skills(skills: list[str]) -> list[str]:
    """
    Remove junk entries from skills list.
    """
    junk_patterns = [
        r'^libraries?:',
        r'^tools?:',
        r'^tech stack:',
        r'^stack:',
        r'\($',
        r'^\(',
        r'\)$',
        r'^and$',
        r'^or$',
        r'\band\b.*\band\b',
    ]

    junk_exact = {
        "data", "and", "or", "the", "with",
        "using", "based", "model evaluation and",
        "learning algorithms", "training",
        "preprocessing",
        "supervised and unsupervised",
    }

    min_len = 2
    max_words = 5
    max_len = 35

    cleaned: list[str] = []
    seen: set[str] = set()

    for skill in skills:
        value = skill.strip()

        if not value:
            continue
        if len(value) < min_len:
            continue
        if len(value) > max_len:
            continue
        if len(value.split()) > max_words:
            continue
        if value.lower() in junk_exact:
            continue
        if ':' in value:
            continue
        if value.startswith('(') or value.endswith('('):
            continue
        if value.startswith(')') or value.endswith(')'):
            continue

        junk = False
        for pattern in junk_patterns:
            if re.search(pattern, value.lower()):
                junk = True
                break
        if junk:
            continue

        key = value.lower()
        normalized = re.sub(r'[\s\-_]', '', key)
        if key in seen or normalized in seen:
            continue

        seen.add(key)
        seen.add(normalized)
        cleaned.append(value)

    return cleaned


def extract_skills_from_categories(raw_text: str) -> list[str]:
    """
    Extract skills from category-format skill sections across the full text.
    """
    soft_skills = {
        "communication", "leadership", "teamwork",
        "team work", "problem solving", "time management",
        "adaptability", "creativity", "critical thinking",
        "interpersonal", "collaboration", "hardworking",
        "self motivated", "quick learner", "work ethic",
        "attention to detail", "multitasking",
    }

    skills: list[str] = []
    category_pattern = re.compile(r'^(?:[A-Za-z\s/()&]+?):\s*(.+?)$', re.MULTILINE)

    for match in category_pattern.finditer(raw_text):
        label = match.group(0).split(':')[0].strip().lower()
        skip_labels = {
            "email", "phone", "linkedin", "github",
            "address", "cgpa", "gpa", "date", "name",
            "university", "college", "school",
        }
        if any(item in label for item in skip_labels):
            continue

        skills_part = match.group(1).strip()
        items = re.split(r'[,|]', skills_part)

        for item in items:
            item = item.strip()
            item = re.sub(r'\([^)]*\)', '', item).strip()
            item = item.rstrip('.')

            if not item:
                continue
            if len(item) < 2 or len(item) > 40:
                continue
            if item.lower() in soft_skills:
                continue
            if len(item.split()) > 5:
                continue

            skills.append(item)

    seen: set[str] = set()
    unique: list[str] = []
    for skill in skills:
        key = skill.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(skill)

    return clean_skills(unique)


def extract_with_llm(raw_text: str) -> dict | None:
    """
    Legacy placeholder kept for compatibility.
    Resume parsing no longer uses Ollama and now relies on
    pdf text extraction, spaCy NER, and regex-based parsing.
    """
    logger.info("[LLM] Disabled for resume parsing; using spaCy + regex pipeline")
    return None


def validate_against_source(result: dict, raw_text: str) -> dict:
    """
    Clear any LLM-returned field that cannot be verified in the source text.
    """
    raw_lower = raw_text.lower()

    full_name = str(result.get("full_name", "")).strip()
    if full_name:
        name_words = full_name.lower().split()
        matches = sum(1 for word in name_words if word in raw_lower)
        if matches < max(1, len(name_words) // 2):
            logger.warning(f"[VALIDATE] Name {full_name!r} not found in source text. Clearing.")
            result["full_name"] = ""
            full_name = ""

    if full_name:
        name_words_lower = [word.lower() for word in full_name.split()]
        text_without_email = re.sub(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", "", raw_text)
        text_without_email_lower = text_without_email.lower()
        matches_without_email = sum(
            1 for word in name_words_lower if word in text_without_email_lower and len(word) > 2
        )
        ratio = matches_without_email / len(name_words_lower)
        if ratio < 0.5:
            logger.warning(
                f"[VALIDATE] Name {full_name!r} only found in email address, not in body text. Clearing."
            )
            result["full_name"] = ""

    email = str(result.get("email", "")).strip()
    if email and email.lower() not in raw_lower:
        logger.warning(f"[VALIDATE] Email {email!r} not in source. Clearing.")
        result["email"] = ""

    validated_skills = []
    for skill in result.get("skills", []):
        if str(skill).lower() in raw_lower:
            validated_skills.append(skill)
        else:
            logger.warning(f"[VALIDATE] Skill {skill!r} not in source. Removing.")
    result["skills"] = validated_skills

    exp = result.get("years_of_experience", 0.0)
    try:
        exp = float(exp)
        if exp < 0 or exp > 40:
            exp = 0.0
    except (TypeError, ValueError):
        exp = 0.0

    student_signals = [
        "b.tech", "btech", "final year", "third year",
        "second year", "first year", "student", "fresher",
        "pursuing", "currently studying", "cgpa", "gpa",
    ]
    if exp > 10 and any(signal in raw_lower for signal in student_signals):
        logger.warning(f"[VALIDATE] Exp {exp} suspicious for student resume. Capping at 2.0")
        exp = min(exp, 2.0)

    degree_patterns = [
        r"b\.?\s*tech.*20\d{2}\s*[-–]\s*20\d{2}",
        r"b\.?\s*e\.?.*20\d{2}\s*[-–]\s*20\d{2}",
        r"bachelor.*20\d{2}\s*[-–]\s*20\d{2}",
        r"bsc.*20\d{2}\s*[-–]\s*20\d{2}",
    ]
    has_degree_dates = any(re.search(pattern, raw_lower) for pattern in degree_patterns)
    work_indicators = [
        "internship", "intern at", "worked at",
        "work experience", "employment", "job role",
        "company:", "organisation:", "organization:",
    ]
    has_work = any(indicator in raw_lower for indicator in work_indicators)
    if has_degree_dates and not has_work and exp > 1.0:
        logger.warning(
            f"[VALIDATE] Degree dates found, no work history. Resetting exp from {exp} to 0.0"
        )
        exp = 0.0

    student_signals = [
        "final year", "final-year",
        "pursuing", "currently pursuing",
        "b.tech student", "btech student",
        "undergraduate student", "ug student",
        "2nd year", "3rd year", "4th year",
        "second year", "third year", "fourth year",
        "fresher", "seeking internship",
        "seeking first", "no prior experience",
        "no work experience", "2026", "graduating",
        "expected graduation", "expected to graduate",
    ]
    is_student = any(signal in raw_lower for signal in student_signals)

    work_section_signals = [
        "work experience", "professional experience",
        "employment history", "internship experience",
        "internship at ", "intern at ",
        "worked at ", "working at ",
        "software engineer at", "developer at",
        "full time", "full-time", "part time", "part-time",
    ]
    has_work_section = any(signal in raw_lower for signal in work_section_signals)

    if is_student and not has_work_section and exp > 1.0:
        logger.warning(
            f"[VALIDATE] Student detected, no work section. Resetting exp from {exp} to 0.0"
        )
        exp = 0.0
    elif is_student and has_work_section and exp > 2.0:
        logger.warning(
            f"[VALIDATE] Student with internship. Capping exp from {exp} to 1.0"
        )
        exp = 1.0

    if has_work_section:
        calculated_exp = extract_experience(raw_text)
        six_months = 0.5
        if calculated_exp < six_months:
            exp = 0.0
            logger.info(
                f"[EXP] Work found but duration "
                f"{calculated_exp}yr < 6 months. "
                f"Setting to 0.0"
            )
        else:
            exp = calculated_exp
            logger.info(f"[EXP] Calculated from dates: {exp} years")

    result["years_of_experience"] = exp

    edu = str(result.get("education_level", "OTHER")).upper()
    edu_signals = {
        "PHD": ["ph.d", "phd", "doctorate", "doctor of philosophy"],
        "MASTER": ["master", "m.tech", "mtech", "m. tech", "msc", "m.sc", "m.s.", "mba", "m.e.", "m.eng", "pgdm"],
        "BACHELOR": ["bachelor", "b.tech", "btech", "b. tech", "b.e", "bsc", "b.sc", "b.s.", "bca", "bba", "b.a", "b.com"],
        "ASSOCIATE": ["associate"],
        "HIGH_SCHOOL": ["high school", "hsc", "ssc", "secondary", "10+2", "higher secondary", "matric"],
    }

    if edu in edu_signals:
        signals = edu_signals[edu]
        if any(signal in raw_lower for signal in signals):
            pass
        else:
            detected = detect_education_from_text(raw_lower)
            logger.warning(
                f"[VALIDATE] Education {edu!r} has no evidence. Overriding with detected: {detected!r}"
            )
            edu = detected

    result["education_level"] = edu

    result["projects"] = clean_project_titles(str(result.get("projects", "")))
    projects = str(result.get("projects", "")).strip()
    if projects:
        stop_words = {
            "a", "an", "the", "and", "or", "of", "in",
            "to", "for", "with", "on", "at", "is", "was",
            "project", "using", "built", "developed",
        }
        project_words = [word for word in projects.lower().split() if word not in stop_words and len(word) > 3]
        if project_words:
            found = sum(1 for word in project_words if word in raw_lower)
            ratio = found / len(project_words)
            if ratio < 0.4:
                logger.warning(f"[VALIDATE] Projects text {ratio:.0%} overlap with source. Clearing.")
                result["projects"] = ""

    return result


def compute_confidence(result: dict, raw_text: str) -> float:
    """
    Return a simple source-backed extraction confidence score.
    """
    score = 0.0
    total = 0

    total += 1
    if result["full_name"]:
        score += 1

    total += 1
    if result["email"]:
        score += 1

    total += 1
    if len(result["skills"]) > 0:
        score += 1

    total += 1
    if result["education_level"] != "OTHER":
        score += 1

    total += 1
    if result["projects"]:
        score += 1

    confidence = round(score / total, 2)
    logger.info(f"[CONFIDENCE] Extraction confidence: {confidence:.0%}")
    return confidence


def parse_and_extract(pdf_bytes: bytes) -> dict:
    """
    Pipeline:
      1. OCR  -> raw text
      2. spaCy NER -> name extraction
      3. Regex -> structured fields + validation
    """
    raw_text = ""

    if pdf_bytes.startswith(b"%PDF"):
        raw_text = extract_text_from_pdf(pdf_bytes)
        # Print FULL OCR text to find where name appears
        logger.info("=== FULL OCR TEXT ===")
        for i, line in enumerate(raw_text.splitlines()):
            if line.strip():
                logger.info(f"  [{i:02d}] {line.strip()!r}")
        logger.info("=== END OCR TEXT ===")
    elif pdf_bytes.startswith(b"PK"):
        raw_text = _extract_text_from_docx(pdf_bytes)

    logger.info("=== RAW OCR (first 400 chars) ===")
    logger.info(repr(raw_text[:400]))

    def is_garbled(text: str) -> bool:
        stripped = text.strip()
        if len(stripped) < 50:
            return True
        alpha_count = sum(1 for char in stripped if char.isalnum())
        ratio = alpha_count / len(stripped)
        if ratio < 0.3:
            return True
        if " " not in stripped and "\n" not in stripped:
            return True
        return False

    if is_garbled(raw_text):
        logger.error(
            f"[PARSER] OCR output appears garbled or corrupted. Raw: {raw_text[:50]!r}. "
            "This file may be password-protected, corrupted, or image-only."
        )
        return {
            "full_name": "",
            "email": "",
            "phone": "",
            "skills": [],
            "years_of_experience": 0.0,
            "education_level": "OTHER",
            "projects": [],
            "resume_text": raw_text,
            "text": raw_text,
            "experience_years": 0.0,
            "education": "OTHER",
            "_extraction_failed": True,
            "_failure_reason": "garbled_ocr",
        }

    logger.info("[PIPELINE] pdfplumber -> spaCy NER -> regex -> validate")

    regex_email = extract_email(raw_text)
    regex_phone = extract_phone(raw_text)
    logger.info(f"[REGEX PRE-EXTRACT] email={regex_email!r} phone={regex_phone!r}")

    logger.info("[PARSER] Using hybrid pipeline: pdfplumber + spaCy NER + regex")

    name = extract_name_spacy(raw_text)
    if not name:
        name = extract_name(raw_text, email=regex_email)
        logger.info(f"[NAME] Regex fallback: {name!r}")

    base_skills = extract_skills(raw_text)
    regex_skills = extract_skills_from_categories(raw_text)
    base_lower = {str(skill).lower() for skill in base_skills}
    additional = [skill for skill in regex_skills if skill.lower() not in base_lower]
    skills = base_skills + additional
    logger.info(
        f"[SKILLS] Regex base: {len(base_skills)}, "
        f"Regex category added: {len(additional)}, "
        f"Total: {len(skills)}"
    )

    result = {
        "full_name": name,
        "email": regex_email,
        "phone": regex_phone,
        "skills": skills,
        "years_of_experience": extract_experience(raw_text),
        "education_level": extract_education(raw_text),
        "projects": extract_project_titles(raw_text),
        "resume_text": raw_text,
    }

    result = validate_against_source(result, raw_text)
    direct_projects = extract_project_titles(raw_text)
    if direct_projects:
        result["projects"] = direct_projects
        logger.info(f"[PROJECTS] Using direct extraction")
    else:
        logger.warning("[PROJECTS] Direct extraction empty")

    result["skills"] = clean_skills(result["skills"])
    logger.info(
        f"[SKILLS] After cleaning: "
        f"{len(result['skills'])} skills"
    )

    _confidence = compute_confidence(result, raw_text)
    result["resume_text"] = raw_text

    logger.info("=== EXTRACTION RESULT ===")
    logger.info(f"  full_name  : {result['full_name']!r}")
    logger.info(f"  email      : {result['email']!r}")
    logger.info(f"  phone      : {result['phone']!r}")
    logger.info(f"  skills     : {result['skills']}")
    logger.info(f"  experience : {result['years_of_experience']}")
    logger.info(f"  education  : {result['education_level']!r}")
    logger.info(f"  projects   : {str(result.get('projects', ''))[:80]!r}")
    logger.info("=========================")

    projects_text = str(result.get("projects", "") or "")

    return {
        "full_name": result.get("full_name", ""),
        "email": result.get("email", ""),
        "phone": result.get("phone", ""),
        "skills": result.get("skills", []),
        "years_of_experience": result.get("years_of_experience", 0.0),
        "education_level": result.get("education_level", "OTHER"),
        "projects": _project_payload(projects_text),
        "resume_text": raw_text,
        # Legacy aliases kept so existing routers continue to work unchanged.
        "text": raw_text,
        "experience_years": result.get("years_of_experience", 0.0),
        "education": result.get("education_level", "OTHER"),
    }
