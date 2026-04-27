"""update_resume_scores

Revision ID: 7f2e4b1c9d10
Revises: 64cad042c585
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = '7f2e4b1c9d10'
down_revision = '64cad042c585'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('resume_scores', sa.Column('jd_id', sa.Integer(), nullable=True))
    op.add_column('resume_scores', sa.Column('skill_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('exp_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('edu_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('project_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('passed', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('resume_scores', sa.Column('matched_skills', sa.JSON(), nullable=True))
    op.add_column('resume_scores', sa.Column('missing_skills', sa.JSON(), nullable=True))
    op.add_column('resume_scores', sa.Column('screened_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()))

    op.create_foreign_key('fk_resume_scores_jd_id', 'resume_scores', 'job_descriptions', ['jd_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_resume_scores_jd_id'), 'resume_scores', ['jd_id'], unique=False)

    op.execute(
        """
        UPDATE resume_scores AS rs
        SET
            jd_id = c.job_description_id,
            skill_score = COALESCE(rs.skills_score, 0),
            exp_score = COALESCE(rs.experience_score, 0),
            edu_score = COALESCE(rs.education_score, 0),
            project_score = COALESCE(rs.semantic_score, 0),
            passed = COALESCE(rs.passed_threshold, false),
            matched_skills = COALESCE(rs.skills_matched, '[]'::json),
            missing_skills = COALESCE(rs.skills_missing, '[]'::json),
            screened_at = COALESCE(rs.scored_at, NOW())
        FROM candidates AS c
        WHERE c.id = rs.candidate_id
        """
    )

    op.alter_column('resume_scores', 'jd_id', nullable=False)
    op.alter_column('resume_scores', 'skill_score', nullable=False)
    op.alter_column('resume_scores', 'exp_score', nullable=False)
    op.alter_column('resume_scores', 'edu_score', nullable=False)
    op.alter_column('resume_scores', 'project_score', nullable=False)
    op.alter_column('resume_scores', 'passed', nullable=False)
    op.alter_column('resume_scores', 'matched_skills', nullable=False)
    op.alter_column('resume_scores', 'missing_skills', nullable=False)
    op.alter_column('resume_scores', 'screened_at', nullable=False)

    op.drop_index(op.f('ix_resume_scores_candidate_id'), table_name='resume_scores')
    op.create_index(op.f('ix_resume_scores_candidate_id'), 'resume_scores', ['candidate_id'], unique=False)
    op.create_unique_constraint('uq_resume_scores_candidate_jd', 'resume_scores', ['candidate_id', 'jd_id'])

    op.drop_column('resume_scores', 'semantic_score')
    op.drop_column('resume_scores', 'skills_score')
    op.drop_column('resume_scores', 'experience_score')
    op.drop_column('resume_scores', 'education_score')
    op.drop_column('resume_scores', 'skills_matched')
    op.drop_column('resume_scores', 'skills_missing')
    op.drop_column('resume_scores', 'score_breakdown')
    op.drop_column('resume_scores', 'ai_summary')
    op.drop_column('resume_scores', 'passed_threshold')
    op.drop_column('resume_scores', 'scored_at')


def downgrade() -> None:
    op.add_column('resume_scores', sa.Column('semantic_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('skills_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('experience_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('education_score', sa.Float(), nullable=True))
    op.add_column('resume_scores', sa.Column('skills_matched', sa.JSON(), nullable=True))
    op.add_column('resume_scores', sa.Column('skills_missing', sa.JSON(), nullable=True))
    op.add_column('resume_scores', sa.Column('score_breakdown', sa.JSON(), nullable=True))
    op.add_column('resume_scores', sa.Column('ai_summary', sa.String(length=1000), nullable=True))
    op.add_column('resume_scores', sa.Column('passed_threshold', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('resume_scores', sa.Column('scored_at', sa.DateTime(timezone=True), nullable=True))

    op.execute(
        """
        UPDATE resume_scores
        SET
            semantic_score = COALESCE(project_score, 0),
            skills_score = COALESCE(skill_score, 0),
            experience_score = COALESCE(exp_score, 0),
            education_score = COALESCE(edu_score, 0),
            skills_matched = COALESCE(matched_skills, '[]'::json),
            skills_missing = COALESCE(missing_skills, '[]'::json),
            score_breakdown = '{}'::json,
            ai_summary = '',
            passed_threshold = COALESCE(passed, false),
            scored_at = COALESCE(screened_at, NOW())
        """
    )

    op.alter_column('resume_scores', 'semantic_score', nullable=False)
    op.alter_column('resume_scores', 'skills_score', nullable=False)
    op.alter_column('resume_scores', 'experience_score', nullable=False)
    op.alter_column('resume_scores', 'education_score', nullable=False)
    op.alter_column('resume_scores', 'skills_matched', nullable=False)
    op.alter_column('resume_scores', 'skills_missing', nullable=False)
    op.alter_column('resume_scores', 'score_breakdown', nullable=False)
    op.alter_column('resume_scores', 'ai_summary', nullable=False)
    op.alter_column('resume_scores', 'passed_threshold', nullable=False)
    op.alter_column('resume_scores', 'scored_at', nullable=False)

    op.drop_constraint('uq_resume_scores_candidate_jd', 'resume_scores', type_='unique')
    op.drop_index(op.f('ix_resume_scores_jd_id'), table_name='resume_scores')
    op.drop_constraint('fk_resume_scores_jd_id', 'resume_scores', type_='foreignkey')
    op.drop_index(op.f('ix_resume_scores_candidate_id'), table_name='resume_scores')
    op.create_index(op.f('ix_resume_scores_candidate_id'), 'resume_scores', ['candidate_id'], unique=True)

    op.drop_column('resume_scores', 'jd_id')
    op.drop_column('resume_scores', 'skill_score')
    op.drop_column('resume_scores', 'exp_score')
    op.drop_column('resume_scores', 'edu_score')
    op.drop_column('resume_scores', 'project_score')
    op.drop_column('resume_scores', 'passed')
    op.drop_column('resume_scores', 'matched_skills')
    op.drop_column('resume_scores', 'missing_skills')
    op.drop_column('resume_scores', 'screened_at')
