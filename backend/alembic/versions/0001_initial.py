"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-02-27
"""

from alembic import op
import sqlalchemy as sa


revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


candidate_status = sa.Enum('Uploaded', 'Screened', 'Shortlisted', 'Interview Sent', 'Interviewed', 'Selected', 'Rejected', name='candidatestatus')
interview_status = sa.Enum('NOT_STARTED', 'STARTED', 'COMPLETED', name='interviewsessionstatus')


def upgrade() -> None:
    op.create_table(
        'hr_users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_hr_users_id', 'hr_users', ['id'])
    op.create_index('ix_hr_users_email', 'hr_users', ['email'], unique=True)

    op.create_table(
        'job_descriptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('hr_user_id', sa.Integer(), sa.ForeignKey('hr_users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('department', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('required_skills', sa.JSON(), nullable=False),
        sa.Column('preferred_skills', sa.JSON(), nullable=False),
        sa.Column('min_experience_years', sa.Float(), nullable=False),
        sa.Column('max_experience_years', sa.Float(), nullable=True),
        sa.Column('education_requirement', sa.String(length=100), nullable=False),
        sa.Column('screening_threshold', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_job_descriptions_id', 'job_descriptions', ['id'])
    op.create_index('ix_job_descriptions_hr_user_id', 'job_descriptions', ['hr_user_id'])

    op.create_table(
        'candidates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('job_description_id', sa.Integer(), sa.ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=80), nullable=True),
        sa.Column('resume_url', sa.String(length=1024), nullable=False),
        sa.Column('resume_text', sa.Text(), nullable=False),
        sa.Column('extracted_skills', sa.JSON(), nullable=False),
        sa.Column('extracted_experience_years', sa.Float(), nullable=False),
        sa.Column('extracted_education', sa.String(length=100), nullable=False),
        sa.Column('extracted_projects', sa.JSON(), nullable=False),
        sa.Column('status', candidate_status, nullable=False),
        sa.Column('interview_token', sa.String(length=255), nullable=True),
        sa.Column('interview_token_expires', sa.DateTime(timezone=True), nullable=True),
        sa.Column('interview_token_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_candidates_id', 'candidates', ['id'])
    op.create_index('ix_candidates_job_description_id', 'candidates', ['job_description_id'])
    op.create_index('ix_candidates_email', 'candidates', ['email'])
    op.create_index('ix_candidates_status', 'candidates', ['status'])

    op.create_table(
        'resume_scores',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=False),
        sa.Column('semantic_score', sa.Float(), nullable=False),
        sa.Column('skills_score', sa.Float(), nullable=False),
        sa.Column('experience_score', sa.Float(), nullable=False),
        sa.Column('education_score', sa.Float(), nullable=False),
        sa.Column('skills_matched', sa.JSON(), nullable=False),
        sa.Column('skills_missing', sa.JSON(), nullable=False),
        sa.Column('score_breakdown', sa.JSON(), nullable=False),
        sa.Column('ai_summary', sa.String(length=1000), nullable=False),
        sa.Column('passed_threshold', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('scored_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('candidate_id'),
    )
    op.create_index('ix_resume_scores_id', 'resume_scores', ['id'])
    op.create_index('ix_resume_scores_candidate_id', 'resume_scores', ['candidate_id'])

    op.create_table(
        'interview_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', interview_status, nullable=False),
        sa.Column('questions', sa.JSON(), nullable=False),
        sa.Column('video_url', sa.String(length=1024), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_score', sa.Float(), nullable=True),
        sa.Column('communication_score', sa.Float(), nullable=True),
        sa.Column('technical_score', sa.Float(), nullable=True),
        sa.Column('behavioral_score', sa.Float(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('ai_analysis', sa.JSON(), nullable=True),
        sa.Column('recommendation', sa.String(length=120), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('candidate_id'),
    )
    op.create_index('ix_interview_sessions_id', 'interview_sessions', ['id'])
    op.create_index('ix_interview_sessions_candidate_id', 'interview_sessions', ['candidate_id'])

    op.create_table(
        'interview_answers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_index', sa.Integer(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', sa.String(length=80), nullable=False),
        sa.Column('answer_text', sa.Text(), nullable=True),
        sa.Column('audio_url', sa.String(length=1024), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('ai_feedback', sa.JSON(), nullable=True),
        sa.Column('answered_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_interview_answers_id', 'interview_answers', ['id'])
    op.create_index('ix_interview_answers_session_id', 'interview_answers', ['session_id'])


def downgrade() -> None:
    op.drop_index('ix_interview_answers_session_id', table_name='interview_answers')
    op.drop_index('ix_interview_answers_id', table_name='interview_answers')
    op.drop_table('interview_answers')

    op.drop_index('ix_interview_sessions_candidate_id', table_name='interview_sessions')
    op.drop_index('ix_interview_sessions_id', table_name='interview_sessions')
    op.drop_table('interview_sessions')

    op.drop_index('ix_resume_scores_candidate_id', table_name='resume_scores')
    op.drop_index('ix_resume_scores_id', table_name='resume_scores')
    op.drop_table('resume_scores')

    op.drop_index('ix_candidates_status', table_name='candidates')
    op.drop_index('ix_candidates_email', table_name='candidates')
    op.drop_index('ix_candidates_job_description_id', table_name='candidates')
    op.drop_index('ix_candidates_id', table_name='candidates')
    op.drop_table('candidates')

    op.drop_index('ix_job_descriptions_hr_user_id', table_name='job_descriptions')
    op.drop_index('ix_job_descriptions_id', table_name='job_descriptions')
    op.drop_table('job_descriptions')

    op.drop_index('ix_hr_users_email', table_name='hr_users')
    op.drop_index('ix_hr_users_id', table_name='hr_users')
    op.drop_table('hr_users')

    op.execute('DROP TYPE IF EXISTS interviewsessionstatus')
    op.execute('DROP TYPE IF EXISTS candidatestatus')
