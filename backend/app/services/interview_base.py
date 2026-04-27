from typing import Any


def generate_base_questions(candidate: Any, jd: Any) -> list[dict[str, str]]:
    projects = candidate.extracted_projects or []
    top_project = projects[0].get('title') if projects else 'a recent project you are proud of'
    req_skills = jd.required_skills or []
    skill_a = req_skills[0] if len(req_skills) > 0 else 'your core technical skill'
    skill_b = req_skills[1] if len(req_skills) > 1 else 'problem-solving'

    return [
        {'question_type': 'intro', 'question_text': 'Please introduce yourself and summarize your background in 60-90 seconds.'},
        {'question_type': 'jd_based', 'question_text': f'For the {jd.title} role, explain your hands-on experience with {skill_a}.'},
        {'question_type': 'jd_based', 'question_text': f'How would you use {skill_b} to deliver impact in this role?'},
        {'question_type': 'project_based', 'question_text': f'Tell us about {top_project}. What was the objective and your role?'},
        {'question_type': 'project_based', 'question_text': 'Describe a tough technical issue in that project and how you resolved it.'},
        {'question_type': 'project_based', 'question_text': 'What measurable outcome did your project deliver and what did you learn?'},
        {'question_type': 'scenario', 'question_text': f'Imagine you joined as a {jd.title} and production breaks before a release. What would you do first?'},
        {'question_type': 'behavioral', 'question_text': 'Describe a teamwork conflict using STAR format and how you handled it.'},
        {'question_type': 'behavioral', 'question_text': 'Tell us about a deadline miss or failure and how you recovered.'},
        {'question_type': 'personality', 'question_text': 'What motivates your work style, and what are your near-term career goals?'},
    ]
