import * as resumeService from './resumeService';
import {ResumeSections} from './resumeService';

// ---------------------------------------------------------------------------
// resumeGenerationService — powers "build a resume matching this job
// description" from src/more/JDAnalyzer.tsx (via src/more/GenerateResume.tsx),
// and the standalone "Create CV" flow.
//
// Content generation is now a real backend call: POST /api/v1/resume/generate
// (app/api/resume_gen.py, Pro-gated) returns a full resume in the standard
// section shape — contact, summary, core skills, certifications,
// professional experience, education, projects, volunteer experience,
// awards, languages, references — tailored to the target role/JD in one LLM
// pass. There is deliberately no "highlights" section anymore; the standard
// section set replaces it.
//
// The actual document (docx/pdf) is rendered server-side — see
// resumeService.updateResumeSections/exportResume, which now render real
// files via app/services/resume_render_service.py rather than just handing
// back whatever raw file the user originally uploaded.
// ---------------------------------------------------------------------------

export type {ResumeSections} from './resumeService';
export type GeneratedResumeContent = ResumeSections;

export interface ResumeGenerationInput {
  role?: string;
  jdText?: string;
  jdAnalysisId?: string;
  existingResume?: ResumeSections | null;
}

/**
 * Calls the real /resume/generate endpoint for a full, standard-sections
 * resume tailored to the target role (and JD, if provided).
 */
export async function generateResumeContent(
  input: ResumeGenerationInput,
): Promise<ResumeSections> {
  return resumeService.generateResume({
    targetRole: input.role,
    jdText: input.jdText,
    jdAnalysisId: input.jdAnalysisId,
    existingResume: input.existingResume,
  });
}

export type ResumeStyle = 'modern' | 'classic' | 'minimal';
export type ResumeDocType = 'resume' | 'cv';

/**
 * Saves the generated content as the user's stored resume (PATCH
 * /api/v1/resume, via updateResumeSections) then requests a rendered
 * download (POST /api/v1/resume/export, via exportResume) as either a
 * standard resume or a CV — same section content, different document title.
 */
export async function generateResumeDocument(
  content: ResumeSections,
  opts: {format: 'pdf' | 'docx'; style: ResumeStyle; docType?: ResumeDocType; name?: string; role?: string},
): Promise<{url?: string}> {
  const mergedContact = {
    ...content.contact,
    name: content.contact.name || opts.name,
  };
  await resumeService.updateResumeSections({
    contact: mergedContact,
    summary: content.summary,
    core_skills: content.coreSkills,
    certifications: content.certifications,
    experience: content.experience,
    education: content.education,
    projects: content.projects,
    volunteer: content.volunteer,
    awards: content.awards,
    languages: content.languages,
    references: content.references,
    suggested_keywords: content.suggestedKeywords,
  });
  const {url} = await resumeService.exportResume(opts.format, opts.style, opts.docType ?? 'resume');
  // The backend has previously been observed returning a raw server-side
  // filesystem path instead of a fetchable download link for the "no
  // structured content yet" fallback path — that's a local path on the
  // BACKEND's disk, not something this device can ever reach over the
  // network, and iOS/Android's Linking.openURL correctly refuses to open it.
  // Treat anything that isn't an http(s) URL as "no usable link" here so the
  // caller falls back to the share-sheet path instead of surfacing that
  // native error.
  const isFetchableUrl = typeof url === 'string' && /^https?:\/\//i.test(url);
  return {url: isFetchableUrl ? url : undefined};
}

/** Plain-text fallback (used when exportResume doesn't return a url yet —
 * e.g. there's no structured content to render — so the feature still
 * produces something the user can share/save via the OS share sheet,
 * rather than a dead end). */
export function toPlainTextResume(
  content: ResumeSections,
  opts: {name?: string; role?: string; docType?: ResumeDocType},
): string {
  const lines: string[] = [];
  const name = content.contact.name || opts.name;
  lines.push(name || (opts.docType === 'cv' ? 'Curriculum Vitae' : 'Resume'));
  if (opts.role) lines.push(opts.role);
  const contactBits = [content.contact.location, content.contact.email, content.contact.phone, ...(content.contact.links ?? [])].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(' · '));

  if (content.summary) lines.push('', 'PROFESSIONAL SUMMARY', content.summary);
  if (content.coreSkills.length) lines.push('', 'CORE SKILLS', content.coreSkills.join(' • '));
  if (content.certifications.length) lines.push('', 'CERTIFICATIONS', ...content.certifications.map(c => `• ${c}`));

  if (content.experience.length) {
    lines.push('', 'PROFESSIONAL EXPERIENCE');
    content.experience.forEach(e => {
      const header = [e.title, e.company].filter(Boolean).join(' — ');
      const sub = [e.location, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
      if (header) lines.push(header);
      if (sub) lines.push(sub);
      e.bullets.forEach(b => lines.push(`• ${b}`));
    });
  }

  if (content.education.length) {
    lines.push('', 'EDUCATION');
    content.education.forEach(e => {
      const header = [e.school, [e.degree, e.field].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      const range = [e.start, e.end].filter(Boolean).join(' – ');
      if (range) lines.push(range);
    });
  }

  if (content.projects.length) {
    lines.push('', 'PROJECTS & PUBLICATIONS');
    content.projects.forEach(p => {
      if (p.name) lines.push(p.name);
      if (p.description) lines.push(p.description);
      if (p.link) lines.push(p.link);
    });
  }

  if (content.volunteer.length) {
    lines.push('', 'VOLUNTEER EXPERIENCE');
    content.volunteer.forEach(v => {
      const header = [v.role, v.org].filter(Boolean).join(' — ');
      if (header) lines.push(header);
      if (v.description) lines.push(v.description);
    });
  }

  if (content.awards.length) lines.push('', 'AWARDS & ACHIEVEMENTS', ...content.awards.map(a => `• ${a}`));
  if (content.languages.length) lines.push('', 'LANGUAGES', content.languages.join(' • '));
  if (content.references.length) {
    lines.push('', 'REFERENCES');
    content.references.forEach(r => {
      lines.push([r.name, r.relationship, r.contact].filter(Boolean).join(' — '));
    });
  }

  if (content.suggestedKeywords.length) {
    lines.push('', 'KEYWORDS TO CONSIDER ADDING', content.suggestedKeywords.join(', '));
  }
  return lines.join('\n');
}
