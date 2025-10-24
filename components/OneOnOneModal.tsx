import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { X, Calendar, Clock, MapPin, Plus, CheckCircle2, Circle, Lock, Users, MessageSquare, Mic, MicOff, Loader2, Sparkles, UploadCloud, Tag, FileText, Trash2 } from 'lucide-react';
import type {
  Employee,
  OneOnOneMeeting,
  OneOnOneAgendaItem,
  OneOnOneSharedNote,
  OneOnOnePrivateNote,
  OneOnOneActionItem,
  OneOnOneMeetingStatus,
  OneOnOneMeetingType,
  OneOnOneActionItemStatus,
  OneOnOneAgendaComment,
  OneOnOneMeetingComment,
  OneOnOneTranscript,
  WorkingGenius
} from '../types';
import { generateOneOnOneSummary } from '../lib/anthropicService';
import { importTranscriptFromFile, normalizeTranscriptText } from '../lib/transcriptImporter';
import { EmployeeNameLink } from './unified';

interface OneOnOneModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  organizationId: string;
  currentUserName: string;
  currentUserId: string;
}

type ModalView = 'list' | 'create' | 'meeting';

interface MeetingForm {
  meetingDate: string;
  meetingTime: string;
  durationType: '30' | '60' | '90';
  location: string;
  meetingType: OneOnOneMeetingType;
  template: 'sonance' | 'rob_roland' | 'okr_focused' | 'delegation' | 'none';
}

// Meeting Templates
const MEETING_TEMPLATES = {
  sonance: {
    name: 'Sonance 1:1 Manager Template',
    sections: [
      {
        title: 'Personal and Professional Check-in',
        items: [
          'How are things going in general?',
          'What is the stress level?',
          'What do you want me to know?',
          'Anything I can do to help?',
          'What are your top three priorities right now?',
          'Is anything slowing you down in being successful on those areas?',
          'How can I help you win?'
        ]
      },
      {
        title: 'Tactical and FYI - Topics',
        items: ['Open discussion topics']
      },
      {
        title: 'Strategic (OKRs)',
        items: ['Are there any issues or conflicts within the team that we need to address?']
      },
      {
        title: 'Can you please give me Feedback?',
        items: ['Open feedback discussion']
      }
    ]
  },
  rob_roland: {
    name: '1:1 Template by Rob Roland',
    sections: [
      {
        title: 'CHECK-IN | How are you doing?',
        items: ['Personal and professional well-being check']
      },
      {
        title: 'TOPICS FOR DECISION | with proposed recommendation',
        items: ['Items requiring decisions']
      },
      {
        title: 'TOPICS FOR DISCUSSION | Items you need to discuss',
        items: ['Discussion topics']
      },
      {
        title: 'OKRs | Progress Update',
        items: ['OKR progress review']
      },
      {
        title: 'AI | How are you leveraging AI today?',
        items: ['AI usage and opportunities']
      }
    ]
  },
  okr_focused: {
    name: 'OKR Focused Conversation Guide',
    sections: [
      {
        title: 'Progress Questions',
        items: [
          'How are you progressing on your OKRs since our last check-in?',
          'Which key result are you most/least confident about right now?',
          'Are we on track to hit this objective by the end of the cycle? What makes you say that?'
        ]
      },
      {
        title: 'Obstacles/Challenge Questions',
        items: [
          'What\'s getting in the way of progress on [specific Key Result]?',
          'Is there anything slowing you down that I can help unblock?',
          'Are you waiting on anyone else or any decisions to move forward?'
        ]
      },
      {
        title: 'Focus & Priority Questions',
        items: [
          'Are you spending enough time on the things that move the needle for these OKRs?',
          'Are there distractions or competing priorities we need to resolve?',
          'What can we de-prioritize to help you focus on this?'
        ]
      },
      {
        title: 'Learning & Adjustment Questions',
        items: [
          'What have you learned so far in working toward this objective?',
          'Do we need to adjust any key results or expectations based on what we now know?',
          'If you had to hit this Key Result in half the time, what would you change?'
        ]
      },
      {
        title: 'Next Steps & Ownership Questions',
        items: [
          'What\'s your next step toward hitting [specific Key Result]?',
          'Who else do you need to work with or influence to make progress?',
          'What would make this OKR feel like a big win at the end of the cycle?'
        ]
      },
      {
        title: 'Metrics & Results Questions',
        items: [
          'What\'s the current metric for [Key Result] and how has it trended?',
          'How will we know if this result is truly moving the objective forward?',
          'What would success look like in hard numbers?'
        ]
      }
    ]
  },
  delegation: {
    name: 'Delegation Framework 1:1 Meeting',
    sections: [
      {
        title: 'Work Distribution',
        items: [
          'Looking at your current work, what\'s on your plate that should be on mine, and what\'s on my plate that should be on yours?',
          'Let\'s review your main projects - which are Level 1 (recommend first), Level 2 (act then inform), or Level 3 (full ownership)?'
        ]
      },
      {
        title: 'Priority Clarity',
        items: ['Pick your biggest priority - can you brief back what success looks like and your next steps?']
      },
      {
        title: 'Growth & Delegation Levels',
        items: [
          'Which Level 1 tasks are you ready to move to Level 2, and what support do you need to get there?',
          'For your Level 2 and 3 projects, when should we check in, and what would make you need to loop me in sooner?',
          'Optional: What skills or experiences do you need to take on more Level 3 (full ownership) work?'
        ]
      }
    ]
  }
};

const WORKING_GENIUS_META: Record<WorkingGenius, { label: string; color: string; border: string; hint: string }> = {
  wonder: {
    label: 'Wonder',
    color: 'bg-sky-100 text-sky-700',
    border: 'border-sky-200',
    hint: 'Surface big questions and explore possibilities.',
  },
  invention: {
    label: 'Invention',
    color: 'bg-purple-100 text-purple-700',
    border: 'border-purple-200',
    hint: 'Brainstorm solutions or new approaches.',
  },
  discernment: {
    label: 'Discernment',
    color: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
    hint: 'Evaluate ideas and apply gut instincts.',
  },
  galvanizing: {
    label: 'Galvanizing',
    color: 'bg-amber-100 text-amber-700',
    border: 'border-amber-200',
    hint: 'Rally momentum and get others moving.',
  },
  enablement: {
    label: 'Enablement',
    color: 'bg-pink-100 text-pink-700',
    border: 'border-pink-200',
    hint: 'Provide timely support and partnership.',
  },
  tenacity: {
    label: 'Tenacity',
    color: 'bg-orange-100 text-orange-700',
    border: 'border-orange-200',
    hint: 'Drive tasks to completion and ensure accountability.',
  },
};

const WORKING_GENIUS_ORDER: WorkingGenius[] = ['wonder', 'invention', 'discernment', 'galvanizing', 'enablement', 'tenacity'];

export default function OneOnOneModal({
  isOpen,
  onClose,
  employee,
  organizationId,
  currentUserName,
  currentUserId,
}: OneOnOneModalProps) {
  const [view, setView] = useState<ModalView>('list');
  const [meetings, setMeetings] = useState<OneOnOneMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<OneOnOneMeeting | null>(null);

  // Meeting form state
  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
    meetingDate: new Date().toISOString().split('T')[0],
    meetingTime: '10:00',
    durationType: '30',
    location: '',
    meetingType: 'regular',
    template: 'sonance',
  });

  // Meeting detail state
  const [agendaItems, setAgendaItems] = useState<OneOnOneAgendaItem[]>([]);
  const [sharedNotes, setSharedNotes] = useState<OneOnOneSharedNote[]>([]);
  const [privateNotes, setPrivateNotes] = useState<OneOnOnePrivateNote[]>([]);
  const [actionItems, setActionItems] = useState<OneOnOneActionItem[]>([]);
  const [agendaComments, setAgendaComments] = useState<Record<string, OneOnOneAgendaComment[]>>({});
  const [agendaCommentDrafts, setAgendaCommentDrafts] = useState<Record<string, string>>({});
  const [meetingComments, setMeetingComments] = useState<OneOnOneMeetingComment[]>([]);
  const [meetingCommentDraft, setMeetingCommentDraft] = useState('');

  // Transcript state
  const [transcriptsStore, setTranscriptsStore] = useState<Record<string, OneOnOneTranscript[]>>({});
  const [transcripts, setTranscripts] = useState<OneOnOneTranscript[]>([]);
  const [transcriptDate, setTranscriptDate] = useState(new Date().toISOString().split('T')[0]);
  const [transcriptTime, setTranscriptTime] = useState(new Date().toISOString().slice(11, 16));
  const [transcriptTagsInput, setTranscriptTagsInput] = useState('');
  const [transcriptContent, setTranscriptContent] = useState('');
  const [transcriptFileName, setTranscriptFileName] = useState('');
  const [transcriptDetectedFormat, setTranscriptDetectedFormat] = useState<string | null>(null);
  const [transcriptParticipants, setTranscriptParticipants] = useState<string[]>([]);
  const [transcriptWarnings, setTranscriptWarnings] = useState<string[]>([]);
  const [transcriptImportWarning, setTranscriptImportWarning] = useState<string | null>(null);
  const [isTranscriptImporting, setIsTranscriptImporting] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<'uploaded' | 'pasted'>('pasted');
  const transcriptFileInputRef = useRef<HTMLInputElement | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  // AI summary state
  const [summaryNotes, setSummaryNotes] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [generatedHighlights, setGeneratedHighlights] = useState<string[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<Array<{ title: string; owner: string; rationale: string }>>([]);
  const [summaryError, setSummaryError] = useState('');

  // Form state
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDescription, setNewAgendaDescription] = useState('');
  const [newSharedNote, setNewSharedNote] = useState('');
  const [newPrivateNote, setNewPrivateNote] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState<'manager' | 'employee'>('employee');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [newSharedNoteGeniuses, setNewSharedNoteGeniuses] = useState<WorkingGenius[]>([]);
  const [newPrivateNoteGeniuses, setNewPrivateNoteGeniuses] = useState<WorkingGenius[]>([]);
  const [newActionGeniuses, setNewActionGeniuses] = useState<WorkingGenius[]>([]);
  const handleCreateMeeting = () => {
    const newMeeting: OneOnOneMeeting = {
      id: `meeting-${Date.now()}`,
      employee_id: employee.id,
      organization_id: organizationId,
      manager_id: currentUserId,
      manager_name: currentUserName,
      meeting_date: `${meetingForm.meetingDate}T${meetingForm.meetingTime}:00Z`,
      status: 'scheduled',
      duration_minutes: parseInt(meetingForm.durationType),
      location: meetingForm.location || undefined,
      meeting_type: meetingForm.meetingType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMeetings([newMeeting, ...meetings]);
    setSelectedMeeting(newMeeting);
    setTranscriptsStore(prev => ({ ...prev, [newMeeting.id]: [] }));
    setTranscripts([]);
    setTranscriptDate(meetingForm.meetingDate);
    setTranscriptTime(meetingForm.meetingTime);
    setTranscriptTagsInput('');
    setTranscriptContent('');
    setTranscriptFileName('');
    setTranscriptSource('pasted');

    // Load template agenda if selected
    const templateAgenda: OneOnOneAgendaItem[] = [];
    if (meetingForm.template !== 'none') {
      const template = MEETING_TEMPLATES[meetingForm.template];
      let orderIndex = 0;

      template.sections.forEach(section => {
        section.items.forEach(item => {
          templateAgenda.push({
            id: `agenda-${Date.now()}-${orderIndex}`,
            meeting_id: newMeeting.id,
            title: item,
            description: `From: ${section.title}`,
            added_by: currentUserName,
            order_index: orderIndex++,
            is_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        });
      });
    }

    setAgendaItems(templateAgenda);
    setSharedNotes([]);
    setPrivateNotes([]);
    setActionItems([]);
    setAgendaComments({});
    setAgendaCommentDrafts({});
    setMeetingComments([]);
    setMeetingCommentDraft('');
    setGeneratedSummary(null);
    setGeneratedHighlights([]);
    setSuggestedActions([]);
    setSummaryNotes('');
    setRecordingUrl(null);
    setRecordingError('');
    setRecordingDuration(0);
    setIsRecording(false);
    setView('meeting');
  };

  const handleOpenMeeting = (meeting: OneOnOneMeeting) => {
    setSelectedMeeting(meeting);
    // In production, fetch meeting details here
    setTranscriptsStore(prev => (prev[meeting.id] ? prev : { ...prev, [meeting.id]: [] }));
    const meetingTime = new Date(meeting.meeting_date);
    setTranscriptDate(meetingTime.toISOString().split('T')[0]);
    setTranscriptTime(meetingTime.toISOString().slice(11, 16));
    setTranscriptTagsInput('');
    setTranscriptContent('');
    setTranscriptFileName('');
    setTranscriptSource('pasted');
    setAgendaComments({});
    setAgendaCommentDrafts({});
    setMeetingComments([]);
    setMeetingCommentDraft('');
    setGeneratedSummary(null);
    setGeneratedHighlights([]);
    setSuggestedActions([]);
    setSummaryNotes('');
    setRecordingUrl(null);
    setRecordingError('');
    setRecordingDuration(0);
    setIsRecording(false);
    setView('meeting');
  };

  const handleAddAgendaItem = () => {
    if (!newAgendaTitle.trim() || !selectedMeeting) return;

    const newItem: OneOnOneAgendaItem = {
      id: `agenda-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      title: newAgendaTitle,
      description: newAgendaDescription || undefined,
      added_by: currentUserName,
      order_index: agendaItems.length,
      is_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setAgendaItems([...agendaItems, newItem]);
    setNewAgendaTitle('');
    setNewAgendaDescription('');
  };

  const handleToggleAgendaItem = (itemId: string) => {
    setAgendaItems(agendaItems.map(item =>
      item.id === itemId
        ? {
            ...item,
            is_completed: !item.is_completed,
            completed_at: !item.is_completed ? new Date().toISOString() : undefined,
          }
        : item
    ));
  };

  const handleAddSharedNote = () => {
    if (!newSharedNote.trim() || !selectedMeeting) return;

    const newNote: OneOnOneSharedNote = {
      id: `shared-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      note: newSharedNote,
      created_by: currentUserName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      working_genius: newSharedNoteGeniuses.length ? [...newSharedNoteGeniuses] : undefined,
    };

    setSharedNotes([...sharedNotes, newNote]);
    setNewSharedNote('');
    setNewSharedNoteGeniuses([]);
  };

  const handleAddPrivateNote = () => {
    if (!newPrivateNote.trim() || !selectedMeeting) return;

    const newNote: OneOnOnePrivateNote = {
      id: `private-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      note: newPrivateNote,
      created_by: currentUserName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      working_genius: newPrivateNoteGeniuses.length ? [...newPrivateNoteGeniuses] : undefined,
    };

    setPrivateNotes([...privateNotes, newNote]);
    setNewPrivateNote('');
    setNewPrivateNoteGeniuses([]);
  };

  const mergeTags = (current: string, additions: string[]) => {
    const normalized = new Set(
      current
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
    );
    additions.forEach(tag => {
      const cleaned = tag.trim();
      if (cleaned) {
        normalized.add(cleaned);
      }
    });
    return Array.from(normalized).join(', ');
  };

  const handleToggleSharedNoteGenius = (noteId: string, genius: WorkingGenius) => {
    setSharedNotes(sharedNotes.map(note =>
      note.id === noteId
        ? {
            ...note,
            working_genius: toggleGeniusSelection(note.working_genius ?? [], genius),
            updated_at: new Date().toISOString(),
          }
        : note
    ));
  };

  const handleTogglePrivateNoteGenius = (noteId: string, genius: WorkingGenius) => {
    setPrivateNotes(privateNotes.map(note =>
      note.id === noteId
        ? {
            ...note,
            working_genius: toggleGeniusSelection(note.working_genius ?? [], genius),
            updated_at: new Date().toISOString(),
          }
        : note
    ));
  };

  const handleToggleNewSharedNoteGenius = (genius: WorkingGenius) => {
    setNewSharedNoteGeniuses(prev => toggleGeniusSelection(prev, genius));
  };

  const handleToggleNewPrivateNoteGenius = (genius: WorkingGenius) => {
    setNewPrivateNoteGeniuses(prev => toggleGeniusSelection(prev, genius));
  };

  const handleToggleNewActionGenius = (genius: WorkingGenius) => {
    setNewActionGeniuses(prev => toggleGeniusSelection(prev, genius));
  };

  const humanizeFormat = (format: string) =>
    format
      .replace(/_/g, ' ')
      .replace(/^[a-z]/, char => char.toUpperCase());

  const resetTranscriptForm = () => {
    setTranscriptTagsInput('');
    setTranscriptContent('');
    setTranscriptFileName('');
    setTranscriptDetectedFormat(null);
    setTranscriptParticipants([]);
    setTranscriptWarnings([]);
    setTranscriptImportWarning(null);
    setTranscriptSource('pasted');
    if (transcriptFileInputRef.current) {
      transcriptFileInputRef.current.value = '';
    }
  };

  const handleTranscriptFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsTranscriptImporting(true);
    setTranscriptImportWarning(null);

    try {
      const imported = await importTranscriptFromFile(file);
      setTranscriptContent(imported.content);
      setTranscriptFileName(file.name);
      setTranscriptSource('uploaded');
      setTranscriptDetectedFormat(imported.detectedFormat);
      setTranscriptParticipants(imported.participants);
      setTranscriptWarnings(imported.warnings);
      if (imported.tags.length) {
        setTranscriptTagsInput(prev => mergeTags(prev, imported.tags));
      }
      setTranscriptImportWarning(imported.warnings.length ? imported.warnings.join(' ') : null);
    } catch (error) {
      console.error('Transcript import failed', error);
      setTranscriptContent('');
      setTranscriptFileName('');
      setTranscriptDetectedFormat(null);
      setTranscriptParticipants([]);
      setTranscriptWarnings([]);
      setTranscriptImportWarning('Unable to process this file. Try exporting the transcript as plain text, VTT, SRT, JSON, or DOCX.');
    } finally {
      setIsTranscriptImporting(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleNormalizeTranscript = () => {
    if (!transcriptContent.trim()) return;

    const imported = normalizeTranscriptText(transcriptContent);
    setTranscriptContent(imported.content);
    setTranscriptDetectedFormat(imported.detectedFormat);
    setTranscriptParticipants(imported.participants);
    setTranscriptWarnings(imported.warnings);
    if (imported.tags.length) {
      setTranscriptTagsInput(prev => mergeTags(prev, imported.tags));
    }
    setTranscriptImportWarning(imported.warnings.length ? imported.warnings.join(' ') : null);
  };

  const handleAddTranscript = () => {
    if (!selectedMeeting) return;
    if (!transcriptContent.trim()) return;

    const recordedAt = transcriptDate
      ? new Date(`${transcriptDate}T${transcriptTime || '00:00'}:00`).toISOString()
      : new Date().toISOString();

    const manualTags = transcriptTagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    const autoTags: string[] = [];
    if (transcriptDetectedFormat) {
      autoTags.push(`format:${transcriptDetectedFormat}`);
    }
    transcriptParticipants.forEach(participant => {
      autoTags.push(`speaker:${participant}`);
    });

    const tags = Array.from(new Set([...manualTags, ...autoTags]));
    const warnings = transcriptWarnings.length ? [...transcriptWarnings] : [];

    const newTranscript: OneOnOneTranscript = {
      id: `transcript-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      recorded_at: recordedAt,
      tags,
      content: transcriptContent.trim(),
      source: transcriptSource,
      file_name: transcriptSource === 'uploaded' ? transcriptFileName || undefined : undefined,
      detected_format: transcriptDetectedFormat || undefined,
      participants: transcriptParticipants.length ? [...transcriptParticipants] : undefined,
      warnings: warnings.length ? warnings : undefined,
      created_at: new Date().toISOString(),
    };

    setTranscripts(prev => {
      const updated = [newTranscript, ...prev];
      setTranscriptsStore(prevStore => ({
        ...prevStore,
        [selectedMeeting.id]: updated,
      }));
      return updated;
    });

    resetTranscriptForm();
  };

  const handleRemoveTranscript = (transcriptId: string) => {
    if (!selectedMeeting) return;
    setTranscripts(prev => {
      const updated = prev.filter(transcript => transcript.id !== transcriptId);
      setTranscriptsStore(prevStore => ({
        ...prevStore,
        [selectedMeeting.id]: updated,
      }));
      return updated;
    });
  };

  const handleAddMeetingComment = () => {
    if (!meetingCommentDraft.trim() || !selectedMeeting) return;

    const comment: OneOnOneMeetingComment = {
      id: `meeting-comment-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      author_id: currentUserId,
      author_name: currentUserName,
      comment: meetingCommentDraft.trim(),
      created_at: new Date().toISOString(),
    };

    setMeetingComments(prev => [...prev, comment]);
    setMeetingCommentDraft('');
  };

  const handleAddAgendaComment = (agendaId: string) => {
    if (!selectedMeeting) return;
    const draft = agendaCommentDrafts[agendaId]?.trim() ?? '';
    if (!draft) return;

    const newComment: OneOnOneAgendaComment = {
      id: `agenda-comment-${Date.now()}`,
      agenda_item_id: agendaId,
      meeting_id: selectedMeeting.id,
      author_id: currentUserId,
      author_name: currentUserName,
      comment: draft,
      created_at: new Date().toISOString(),
    };

    setAgendaComments(prev => ({
      ...prev,
      [agendaId]: [...(prev[agendaId] || []), newComment],
    }));

    setAgendaCommentDrafts(prev => ({
      ...prev,
      [agendaId]: '',
    }));
  };

  const recordingSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const startRecording = async () => {
    if (!recordingSupported) {
      setRecordingError('Audio recording is not supported in this browser. Please try Chrome or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        recordingChunksRef.current = [];
        const url = URL.createObjectURL(blob);
        setRecordingUrl(prev => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return url;
        });
        stream.getTracks().forEach(track => track.stop());
      };

      setRecordingError('');
      setRecordingDuration(0);
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error: any) {
      console.error('Unable to start recording:', error);
      setRecordingError(error?.message || 'Unable to access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const clearRecording = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingUrl(null);
    setRecordingDuration(0);
  };

  const handleGenerateSummary = async () => {
    if (!selectedMeeting) return;

    setIsGeneratingSummary(true);
    setSummaryError('');
    try {
      const agendaContext = agendaItems.map(item => ({
        title: item.title,
        description: item.description,
        comments: (agendaComments[item.id] || []).map(comment => `${comment.author_name}: ${comment.comment}`),
      }));

      const response = await generateOneOnOneSummary({
        managerName: currentUserName,
        employeeName: employee.name,
        agenda: agendaContext,
        sharedNotes: sharedNotes.map(note => `${note.created_by}: ${note.note}`),
        meetingComments: meetingComments.map(comment => `${comment.author_name}: ${comment.comment}`),
        existingActionItems: actionItems.map(action => ({
          title: action.title,
          owner: action.assigned_to,
        })),
        highlights: summaryNotes.trim(),
      });

      setGeneratedSummary(response.summary);
      setGeneratedHighlights(response.highlights || []);
      setSuggestedActions(response.suggestedActionItems || []);
    } catch (error: any) {
      setSummaryError(error?.message || 'Unable to generate summary.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleAdoptSuggestedAction = (index: number) => {
    if (!selectedMeeting) return;
    const suggestion = suggestedActions[index];
    if (!suggestion) return;

    const assignedTo = suggestion.owner.toLowerCase().includes('manager') ? currentUserName : employee.name;

    const newAction: OneOnOneActionItem = {
      id: `action-${Date.now()}-${index}`,
      meeting_id: selectedMeeting.id,
      title: suggestion.title,
      description: suggestion.rationale,
      assigned_to: assignedTo,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActionItems(prev => [...prev, newAction]);
    setSuggestedActions(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!isRecording) {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return;
    }

    setRecordingDuration(0);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  useEffect(() => {
    if (!selectedMeeting) return;
    const existingTranscripts = transcriptsStore[selectedMeeting.id];
    setTranscripts(existingTranscripts ? [...existingTranscripts] : []);
  }, [selectedMeeting, transcriptsStore]);

  useEffect(() => {
    if (!transcriptContent.trim()) {
      setTranscriptDetectedFormat(null);
      setTranscriptParticipants([]);
      setTranscriptWarnings([]);
      setTranscriptImportWarning(null);
    }
  }, [transcriptContent]);

  if (!isOpen) return null;

  const handleAddActionItem = () => {
    if (!newActionTitle.trim() || !selectedMeeting) return;

    const newAction: OneOnOneActionItem = {
      id: `action-${Date.now()}`,
      meeting_id: selectedMeeting.id,
      title: newActionTitle,
      assigned_to: newActionAssignee === 'manager' ? currentUserName : employee.name,
      due_date: newActionDueDate || undefined,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      working_genius: newActionGeniuses.length ? [...newActionGeniuses] : undefined,
    };

    setActionItems([...actionItems, newAction]);
    setNewActionTitle('');
    setNewActionAssignee('employee');
    setNewActionDueDate('');
    setNewActionGeniuses([]);
  };

  const handleUpdateActionStatus = (actionId: string, status: OneOnOneActionItemStatus) => {
    setActionItems(actionItems.map(action =>
      action.id === actionId
        ? {
            ...action,
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString(),
          }
        : action
    ));
  };

  const handleToggleActionItemGenius = (actionId: string, genius: WorkingGenius) => {
    setActionItems(actionItems.map(action =>
      action.id === actionId
        ? {
            ...action,
            working_genius: toggleGeniusSelection(action.working_genius ?? [], genius),
            updated_at: new Date().toISOString(),
          }
        : action
    ));
  };

  const handleUpdateMeetingStatus = (status: OneOnOneMeetingStatus) => {
    if (!selectedMeeting) return;

    const updatedMeeting = { ...selectedMeeting, status };
    setSelectedMeeting(updatedMeeting);
    setMeetings(meetings.map(m => m.id === selectedMeeting.id ? updatedMeeting : m));
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const toggleGeniusSelection = (list: WorkingGenius[], genius: WorkingGenius) =>
    list.includes(genius) ? list.filter(item => item !== genius) : [...list, genius];

  const renderGeniusSelector = (
    selected: WorkingGenius[],
    onToggle: (genius: WorkingGenius) => void,
    size: 'sm' | 'md' = 'md'
  ) => (
    <div className="flex flex-wrap gap-2">
      {WORKING_GENIUS_ORDER.map((genius) => {
        const meta = WORKING_GENIUS_META[genius];
        const active = selected.includes(genius);
        const baseSize = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
        return (
          <button
            key={genius}
            type="button"
            onClick={() => onToggle(genius)}
            title={meta.hint}
            className={`rounded-full border transition focus:outline-none focus:ring-2 focus:ring-indigo-200 ${baseSize} ${
              active
                ? `${meta.color} ${meta.border} shadow-sm`
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );

  const renderGeniusBadges = (selected: WorkingGenius[]) => {
    if (!selected.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {selected.map((genius) => {
          const meta = WORKING_GENIUS_META[genius];
          return (
            <span
              key={genius}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color} ${meta.border}`}
            >
              {meta.label}
            </span>
          );
        })}
      </div>
    );
  };

  const formatFullDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getStatusColor = (status: OneOnOneMeetingStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionStatusColor = (status: OneOnOneActionItemStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">One-on-One Meetings</h2>
              <p className="text-purple-100 text-sm">
                <EmployeeNameLink
                  employee={employee}
                  className="font-semibold text-white hover:text-purple-100 focus-visible:ring-white"
                  onClick={(event) => event.stopPropagation()}
                />
                {' '}
                • {employee.title || 'No Title'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* View Navigation */}
        {view !== 'list' && (
          <div className="px-6 pt-4 border-b">
            <button
              onClick={() => setView('list')}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
            >
              ← Back to Meetings
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'list' && (
            <div className="p-6">
              {/* Create Meeting Button */}
              <button
                onClick={() => setView('create')}
                className="w-full mb-6 py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Schedule New Meeting
              </button>

              {/* Meetings List */}
              {meetings.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    No Meetings Yet
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Schedule your first one-on-one meeting with{' '}
                    <EmployeeNameLink
                      employee={employee}
                      className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      onClick={() => handleOpenMeeting(meeting)}
                      className="p-5 border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <Calendar className="w-5 h-5 text-purple-600 mt-1" />
                          <div>
                            <p className="font-semibold text-gray-900">
                              {formatDateTime(meeting.meeting_date)}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {meeting.duration_minutes} min
                              </span>
                              {meeting.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {meeting.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                          {meeting.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="ml-8">
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {meeting.meeting_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'create' && (
            <div className="p-6 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Schedule New Meeting</h3>

              <div className="space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingForm.meetingDate}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Time
                  </label>
                  <input
                    type="time"
                    value={meetingForm.meetingTime}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['30', '60', '90'].map((duration) => (
                      <button
                        key={duration}
                        onClick={() => setMeetingForm({ ...meetingForm, durationType: duration as '30' | '60' | '90' })}
                        className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                          meetingForm.durationType === duration
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {duration} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                    placeholder="e.g., Conference Room A, Zoom, etc."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Meeting Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Type
                  </label>
                  <select
                    value={meetingForm.meetingType}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingType: e.target.value as OneOnOneMeetingType })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="regular">Regular Check-in</option>
                    <option value="performance">Performance Review</option>
                    <option value="development">Career Development</option>
                    <option value="check_in">Quick Check-in</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Agenda Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agenda Template
                  </label>
                  <select
                    value={meetingForm.template}
                    onChange={(e) => setMeetingForm({ ...meetingForm, template: e.target.value as MeetingForm['template'] })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="sonance">Sonance 1:1 Manager Template (Recommended)</option>
                    <option value="rob_roland">1:1 Template by Rob Roland</option>
                    <option value="okr_focused">OKR Focused Conversation Guide</option>
                    <option value="delegation">Delegation Framework 1:1 Meeting</option>
                    <option value="none">Blank Agenda (No Template)</option>
                  </select>
                  {meetingForm.template !== 'none' && (
                    <p className="mt-2 text-sm text-gray-600">
                      ✓ {MEETING_TEMPLATES[meetingForm.template].name} will be added to the agenda
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setView('list')}
                    className="flex-1 py-3 px-6 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMeeting}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Create Meeting
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'meeting' && selectedMeeting && (
            <div className="p-6">
              {/* Meeting Header */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {formatDateTime(selectedMeeting.meeting_date)}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {selectedMeeting.duration_minutes} minutes
                      </span>
                      {selectedMeeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {selectedMeeting.location}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-white rounded text-xs font-medium">
                        {selectedMeeting.meeting_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedMeeting.status)}`}>
                      {selectedMeeting.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Meeting Controls */}
                {selectedMeeting.status === 'scheduled' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateMeetingStatus('in_progress')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Start Meeting
                    </button>
                    <button
                      onClick={() => handleUpdateMeetingStatus('cancelled')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Cancel Meeting
                    </button>
                  </div>
                )}
                {selectedMeeting.status === 'in_progress' && (
                  <button
                    onClick={() => handleUpdateMeetingStatus('completed')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    Complete Meeting
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Agenda & Shared Notes */}
                <div className="space-y-6">
                  {/* Agenda Items */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Agenda Items
                    </h4>

                    {/* Add Agenda Item */}
                    <div className="mb-4 space-y-2">
                      <input
                        type="text"
                        value={newAgendaTitle}
                        onChange={(e) => setNewAgendaTitle(e.target.value)}
                        placeholder="Agenda item title..."
                        maxLength={200}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <textarea
                        value={newAgendaDescription}
                        onChange={(e) => setNewAgendaDescription(e.target.value)}
                        placeholder="Description (optional)..."
                        maxLength={2000}
                        rows={2}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                      <button
                        onClick={handleAddAgendaItem}
                        disabled={!newAgendaTitle.trim()}
                        className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Agenda Item
                      </button>
                    </div>

                    {/* Agenda List */}
                    <div className="space-y-2">
                      {agendaItems.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No agenda items yet. Add topics to discuss.
                        </p>
                      ) : (
                        agendaItems.map((item) => {
                          const itemComments = agendaComments[item.id] || [];
                          const commentDraft = agendaCommentDrafts[item.id] ?? '';

                          return (
                            <div key={item.id} className="space-y-3 rounded-lg bg-gray-50 p-3">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleAgendaItem(item.id)}
                                  className="mt-0.5 flex-shrink-0"
                                >
                                  {item.is_completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-1">
                                    Added by {item.added_by}
                                  </p>
                                </div>
                              </div>

                              {itemComments.length > 0 && (
                                <div className="space-y-2">
                                  {itemComments.map((comment) => (
                                    <div key={comment.id} className="rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700">
                                      <div className="flex items-center gap-2 text-gray-500">
                                        <MessageSquare className="h-3 w-3 text-purple-500" />
                                        <span className="font-semibold text-gray-700">{comment.author_name}</span>
                                        <span className="text-gray-400">{formatRelativeTime(comment.created_at)}</span>
                                      </div>
                                      <p className="mt-1 whitespace-pre-wrap text-gray-800">{comment.comment}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-start gap-2">
                                <textarea
                                  value={commentDraft}
                                  onChange={(e) => setAgendaCommentDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  placeholder="Add a quick comment or note for this topic..."
                                  rows={2}
                                  className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                                <button
                                  onClick={() => handleAddAgendaComment(item.id)}
                                  disabled={!commentDraft.trim()}
                                  className="flex-shrink-0 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Comment
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Shared Notes */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Shared Notes
                      <span className="text-xs font-normal text-gray-500">(Both can see)</span>
                    </h4>

                    {/* Add Shared Note */}
                    <div className="mb-4 space-y-2">
                      <textarea
                        value={newSharedNote}
                        onChange={(e) => setNewSharedNote(e.target.value)}
                        placeholder="Add a shared note that both you and the employee can see..."
                        maxLength={5000}
                        rows={3}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Working Genius focus</p>
                        {renderGeniusSelector(newSharedNoteGeniuses, handleToggleNewSharedNoteGenius)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {newSharedNote.length}/5000
                        </span>
                        <button
                          onClick={handleAddSharedNote}
                          disabled={!newSharedNote.trim()}
                          className="py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Note
                        </button>
                      </div>
                    </div>

                    {/* Shared Notes List */}
                    <div className="space-y-3">
                      {sharedNotes.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No shared notes yet. Document discussion points here.
                        </p>
                      ) : (
                        sharedNotes.map((note) => (
                          <div key={note.id} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Users className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs font-semibold text-gray-900">
                                    {note.created_by}
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-semibold rounded">
                                    Shared
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-gray-700">
                                  <Calendar className="w-3 h-3" />
                                  <span className="font-medium">{formatFullDateTime(note.created_at)}</span>
                                  <span className="text-gray-500">({formatRelativeTime(note.created_at)})</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                              {note.note}
                            </p>
                            {renderGeniusBadges(note.working_genius ?? [])}
                            <div className="mt-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">
                                Tag Working Genius
                              </p>
                              {renderGeniusSelector(note.working_genius ?? [], (genius) => handleToggleSharedNoteGenius(note.id, genius), 'sm')}
                            </div>
                          </div>
                        ))
                      )}
                  </div>
                </div>

                  {/* Meeting Discussion Comments */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-500" />
                      Meeting Discussion
                    </h4>

                    <div className="mb-4 space-y-2">
                      <textarea
                        value={meetingCommentDraft}
                        onChange={(e) => setMeetingCommentDraft(e.target.value)}
                        placeholder="Capture real-time observations, commitments, or follow-ups..."
                        rows={3}
                        maxLength={3000}
                        className="w-full resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{meetingCommentDraft.length}/3000</span>
                        <button
                          onClick={handleAddMeetingComment}
                          disabled={!meetingCommentDraft.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Add Comment
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {meetingComments.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No comments captured yet. Use this space to log key discussion moments.
                        </p>
                      ) : (
                        meetingComments.map(comment => (
                          <div key={comment.id} className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">
                            <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">{comment.author_name}</span>
                              <span>·</span>
                              <span>{formatRelativeTime(comment.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{comment.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
              </div>

              {/* Right Column: Private Notes & Action Items */}
              <div className="space-y-6">
                  {/* Recording & Summary */}
                  <div className="space-y-4 rounded-xl border-2 border-purple-200 bg-purple-50/40 p-5">
                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Mic className="w-5 h-5 text-purple-600" />
                      Recording & AI Summary
                    </h4>

                    <div className="space-y-3 rounded-lg border border-purple-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Live recording</p>
                          <p className="text-xs text-gray-500">Capture the conversation for reference.</p>
                        </div>
                        <span className="text-sm font-semibold text-purple-600">{formatDuration(recordingDuration)}</span>
                      </div>

                      {recordingError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          {recordingError}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {!isRecording ? (
                          <button
                            onClick={startRecording}
                            disabled={!recordingSupported}
                            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Mic className="h-4 w-4" />
                            Start recording
                          </button>
                        ) : (
                          <button
                            onClick={stopRecording}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                          >
                            <MicOff className="h-4 w-4" />
                            Stop recording
                          </button>
                        )}

                        {recordingUrl && (
                          <button
                            onClick={clearRecording}
                            className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-600 hover:bg-purple-100"
                          >
                            Remove recording
                          </button>
                        )}
                      </div>

                      {recordingUrl && (
                        <audio controls className="w-full">
                          <source src={recordingUrl} type="audio/webm" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Highlights or transcript snippets (optional)
                      </label>
                      <textarea
                        value={summaryNotes}
                        onChange={(e) => setSummaryNotes(e.target.value)}
                        placeholder="Capture key quotes, decisions, or transcript excerpts to help the AI summarize."
                        rows={3}
                        maxLength={4000}
                        className="w-full resize-none rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          onClick={handleGenerateSummary}
                          disabled={isGeneratingSummary}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {isGeneratingSummary ? 'Summarizing...' : 'Generate AI summary'}
                        </button>
                        <span className="text-xs text-gray-500">Uses agenda notes, comments, and highlights</span>
                      </div>

                      {summaryError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          {summaryError}
                        </p>
                      )}

                      {generatedSummary && (
                        <div className="space-y-3 rounded-lg border border-indigo-200 bg-white p-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">AI Summary</p>
                            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedSummary}</p>
                          </div>
                          {generatedHighlights.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Highlights</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                                {generatedHighlights.map((highlight, index) => (
                                  <li key={index}>{highlight}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {suggestedActions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Suggested action items</p>
                              <ul className="space-y-2">
                                {suggestedActions.map((suggestion, index) => (
                                  <li key={`${suggestion.title}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                                    <p className="font-semibold text-gray-800">{suggestion.title}</p>
                                    <p className="text-xs text-gray-500">Owner: {suggestion.owner}</p>
                                    <p className="mt-1 text-xs text-gray-500">{suggestion.rationale}</p>
                                    <button
                                      onClick={() => handleAdoptSuggestedAction(index)}
                                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add to action items
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transcript Ingestion */}
                  <div className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-5">
                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-600" />
                      Transcript Library
                    </h4>

                    <div className="space-y-4 rounded-lg border border-amber-200 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            Conversation date
                          </label>
                          <input
                            type="date"
                            value={transcriptDate}
                            onChange={(event) => setTranscriptDate(event.target.value)}
                            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            Time (local)
                          </label>
                          <input
                            type="time"
                            value={transcriptTime}
                            onChange={(event) => setTranscriptTime(event.target.value)}
                            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={transcriptTagsInput}
                          onChange={(event) => setTranscriptTagsInput(event.target.value)}
                          placeholder="growth, recognition, blockers"
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                        <p className="text-xs text-amber-700/70">Separate tags with commas to make transcripts searchable later.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Transcript
                        </label>
                        <textarea
                          value={transcriptContent}
                          onChange={(event) => setTranscriptContent(event.target.value)}
                          placeholder="Paste the meeting transcript or enter key moments..."
                          rows={5}
                          className="w-full resize-y rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800/70">
                          <span>{transcriptContent.length.toLocaleString()} characters</span>
                          {transcriptFileName && (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <FileText className="h-3.5 w-3.5" />
                              {transcriptFileName}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-xs text-amber-800/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleNormalizeTranscript}
                              disabled={!transcriptContent.trim()}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-3 py-1.5 font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Clean & detect structure
                            </button>
                            {transcriptDetectedFormat && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                                <FileText className="h-3 w-3" />
                                Detected {humanizeFormat(transcriptDetectedFormat!)} transcript
                              </span>
                            )}
                          </div>

                          {transcriptParticipants.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {transcriptParticipants.map((participant) => (
                                <span
                                  key={`participant-${participant}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700"
                                >
                                  <Users className="h-3 w-3" />
                                  {participant}
                                </span>
                              ))}
                            </div>
                          )}

                          {transcriptImportWarning && (
                            <p className="rounded-md border border-amber-200 bg-amber-100/70 px-3 py-2 text-amber-800">
                              {transcriptImportWarning}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
                          <UploadCloud className="h-4 w-4" />
                          Import from file
                          <input
                            ref={transcriptFileInputRef}
                            type="file"
                            accept=".txt,.md,.rtf,.log,.docx,.vtt,.srt,.json,.csv,.tsv"
                            className="hidden"
                            onChange={handleTranscriptFileSelect}
                          />
                        </label>
                        {isTranscriptImporting && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Reading file…
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={resetTranscriptForm}
                          className="text-xs font-medium text-amber-600 underline decoration-dotted underline-offset-2 hover:text-amber-700"
                        >
                          Clear form
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-800/70">
                          Tag topics now so you can surface transcripts during calibration.
                        </span>
                        <button
                          onClick={handleAddTranscript}
                          disabled={isTranscriptImporting || !transcriptContent.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add transcript entry
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {transcripts.length === 0 ? (
                        <p className="text-sm text-amber-800/70 text-center py-4">
                          No transcript entries yet. Paste or import conversations to keep coaching moments searchable.
                        </p>
                      ) : (
                        transcripts.map((transcript) => (
                          <div key={transcript.id} className="space-y-3 rounded-lg border border-amber-200 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span className="font-semibold text-gray-800">{formatFullDateTime(transcript.recorded_at)}</span>
                                  <span className="text-gray-400">({formatRelativeTime(transcript.recorded_at)})</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Source: {transcript.source === 'uploaded' ? 'Uploaded file' : 'Pasted text'}
                                  {transcript.file_name ? ` • ${transcript.file_name}` : ''}
                                </div>
                                {(transcript.detected_format || (transcript.participants && transcript.participants.length > 0)) && (
                                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-amber-700">
                                    {transcript.detected_format && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold">
                                        <FileText className="h-3 w-3" />
                                        Format: {humanizeFormat(transcript.detected_format!)}
                                      </span>
                                    )}
                                    {transcript.participants?.map((participant) => (
                                      <span
                                        key={`${transcript.id}-participant-${participant}`}
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold"
                                      >
                                        <Users className="h-3 w-3" />
                                        {participant}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveTranscript(transcript.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>

                            {transcript.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {transcript.tags.map((tag) => (
                                  <span
                                    key={`${transcript.id}-${tag}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                                  >
                                    <Tag className="h-3 w-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {transcript.warnings && transcript.warnings.length > 0 && (
                              <p className="rounded-md border border-amber-200 bg-amber-100/70 px-3 py-2 text-xs text-amber-800">
                                {transcript.warnings.join(' ')}
                              </p>
                            )}

                            <div className="max-h-48 overflow-y-auto rounded-md border border-amber-100 bg-amber-50/60 p-3 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                              {transcript.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Private Manager Notes */}
                  <div className="border-2 border-orange-200 rounded-xl p-5 bg-orange-50/30">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-orange-600" />
                      Private Manager Notes
                      <span className="text-xs font-normal text-gray-500">(Manager only)</span>
                    </h4>

                    {/* Add Private Note */}
                    <div className="mb-4 space-y-2">
                      <textarea
                        value={newPrivateNote}
                        onChange={(e) => setNewPrivateNote(e.target.value)}
                        placeholder="Private observations, concerns, or reminders (not visible to employee)..."
                        maxLength={5000}
                        rows={3}
                        className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none bg-white"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">Working Genius focus</p>
                        {renderGeniusSelector(newPrivateNoteGeniuses, handleToggleNewPrivateNoteGenius)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {newPrivateNote.length}/5000
                        </span>
                        <button
                          onClick={handleAddPrivateNote}
                          disabled={!newPrivateNote.trim()}
                          className="py-2 px-4 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          Add Private Note
                        </button>
                      </div>
                    </div>

                    {/* Private Notes List */}
                    <div className="space-y-3">
                      {privateNotes.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No private notes yet. Track confidential observations here.
                        </p>
                      ) : (
                        privateNotes.map((note) => (
                          <div key={note.id} className="p-4 bg-white border-2 border-orange-300 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Lock className="w-4 h-4 text-orange-600" />
                                  <span className="text-xs font-semibold text-gray-900">
                                    {note.created_by}
                                  </span>
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                                    Private
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-gray-700">
                                  <Calendar className="w-3 h-3" />
                                  <span className="font-medium">{formatFullDateTime(note.created_at)}</span>
                                  <span className="text-gray-500">({formatRelativeTime(note.created_at)})</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                              {note.note}
                            </p>
                            {renderGeniusBadges(note.working_genius ?? [])}
                            <div className="mt-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600 mb-1">Tag Working Genius</p>
                              {renderGeniusSelector(note.working_genius ?? [], (genius) => handleTogglePrivateNoteGenius(note.id, genius), 'sm')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Action Items */}
                  <div className="border-2 border-gray-200 rounded-xl p-5">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Action Items
                    </h4>

                    {/* Add Action Item */}
                    <div className="mb-4 space-y-2">
                      <input
                        type="text"
                        value={newActionTitle}
                        onChange={(e) => setNewActionTitle(e.target.value)}
                        placeholder="Action item..."
                        maxLength={200}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newActionAssignee}
                          onChange={(e) => setNewActionAssignee(e.target.value as 'manager' | 'employee')}
                          className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="employee">Assign to {employee.name}</option>
                          <option value="manager">Assign to Me</option>
                        </select>
                        <input
                          type="date"
                          value={newActionDueDate}
                          onChange={(e) => setNewActionDueDate(e.target.value)}
                          className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">Working Genius driver</p>
                        {renderGeniusSelector(newActionGeniuses, handleToggleNewActionGenius)}
                      </div>
                      <button
                        onClick={handleAddActionItem}
                        disabled={!newActionTitle.trim()}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Action Item
                      </button>
                    </div>

                    {/* Action Items List */}
                    <div className="space-y-2">
                      {actionItems.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No action items yet. Add follow-up tasks here.
                        </p>
                      ) : (
                        actionItems.map((action) => (
                          <div
                            key={action.id}
                            className="p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900 flex-1">
                                {action.title}
                              </p>
                              <select
                                value={action.status}
                                onChange={(e) => handleUpdateActionStatus(action.id, e.target.value as OneOnOneActionItemStatus)}
                                className={`text-xs px-2 py-1 rounded border-0 font-medium ${getActionStatusColor(action.status)}`}
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="font-medium">{action.assigned_to}</span>
                              {action.due_date && (
                                <span>Due: {new Date(action.due_date).toLocaleDateString()}</span>
                              )}
                            </div>
                            {renderGeniusBadges(action.working_genius ?? [])}
                            <div className="mt-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 mb-1">Tag Working Genius</p>
                              {renderGeniusSelector(action.working_genius ?? [], (genius) => handleToggleActionItemGenius(action.id, genius), 'sm')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
