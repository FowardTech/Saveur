import {IconPack} from '@ui-kitten/components';
import {
  Activity,
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart2,
  Bell,
  Book,
  BookOpen,
  Box,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Clipboard,
  Clock,
  Code2,
  Compass,
  Copy,
  CornerUpLeft,
  CreditCard,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Flag,
  Gift,
  Globe,
  Globe2,
  Grid,
  Headphones,
  Heart,
  HelpCircle,
  Home,
  Inbox,
  Info,
  Lightbulb,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  MinusCircle,
  Percent,
  PieChart,
  Pin,
  PlayCircle,
  Plus,
  PlusCircle,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Settings2,
  Share2,
  Shield,
  Smile,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
  XCircle,
  Zap,
} from 'lucide-react-native';
import {lucideIcon} from './lucideIcon';

// Replaces @ui-kitten/eva-icons' EvaIconsPack (registered under the SAME
// pack name, 'eva' — see App.tsx's IconRegistry) with lucide-react-native
// equivalents, per explicit product direction to use the admin dashboard's
// icon style (lucide-react) everywhere in the mobile app. Keyed by the
// EXACT eva icon name strings already used at every <Icon pack="eva"
// name="..."/> call site across the app (email-outline, close-outline,
// etc.) — same drop-in-swap approach as AssetIconsPack.tsx, so no call site
// needed to change. This list was built from an exhaustive grep of every
// literal eva icon name string in the codebase (including ones assigned to
// data arrays rather than typed directly in JSX, e.g. AppTour.tsx's step
// definitions) — if a screen added after this pass introduces a new eva
// icon name not listed here, it will render blank; add the missing name +
// its closest lucide-react-native equivalent here rather than in the
// call site.
const LucideEvaIconsPack: IconPack<any> = {
  name: 'eva',
  icons: {
    'activity-outline': lucideIcon(Activity),
    'alert-circle-outline': lucideIcon(AlertCircle),
    'arrow-forward-outline': lucideIcon(ArrowRight),
    'arrow-upward-outline': lucideIcon(ArrowUp),
    'award-outline': lucideIcon(Award),
    // Filled variant (full reskin — Leaderboard.tsx's podium crown icon,
    // src/home/Leaderboard.tsx, added this session) — same "outline vs
    // solid via the `filled` param" convention as the tab-bar Active icons
    // further down; a crown/award reads better solid than outlined.
    award: lucideIcon(Award, true),
    'bar-chart-outline': lucideIcon(BarChart2),
    'bar-chart-2-outline': lucideIcon(BarChart2),
    'bell-outline': lucideIcon(Bell),
    'book-open-outline': lucideIcon(BookOpen),
    'book-outline': lucideIcon(Book),
    'briefcase-outline': lucideIcon(Briefcase),
    'bulb-outline': lucideIcon(Lightbulb),
    'calendar-outline': lucideIcon(Calendar),
    'checkmark-circle-2-outline': lucideIcon(CheckCircle2),
    'checkmark-circle-2': lucideIcon(CheckCircle2),
    'checkmark-outline': lucideIcon(Check),
    'checkmark-square-2-outline': lucideIcon(CheckSquare2),
    'chevron-down-outline': lucideIcon(ChevronDown),
    'chevron-up-outline': lucideIcon(ChevronUp),
    'clipboard-outline': lucideIcon(Clipboard),
    'clock-outline': lucideIcon(Clock),
    'close-circle-outline': lucideIcon(XCircle),
    'close-outline': lucideIcon(X),
    'code-outline': lucideIcon(Code2),
    'compass-outline': lucideIcon(Compass),
    'copy-outline': lucideIcon(Copy),
    'corner-up-left-outline': lucideIcon(CornerUpLeft),
    'credit-card-outline': lucideIcon(CreditCard),
    // AI Interview Laboratory personas (product request item) — admin-
    // editable icon field on app_config_service.py's "interview_personas"
    // section; these 5 names were introduced with that feature and weren't
    // in this pack yet, which crashed the persona picker in
    // MockInterviewSetup.tsx the moment it rendered (same "Icon ... not
    // registered in pack 'eva'" error PersonalizationCard.tsx's
    // chevron-right-outline hit — see that fix's commit).
    'cube-outline': lucideIcon(Box),
    'minus-circle-outline': lucideIcon(MinusCircle),
    'question-mark-circle-outline': lucideIcon(HelpCircle),
    'rocket-outline': lucideIcon(Rocket),
    'smiling-face-outline': lucideIcon(Smile),
    'download-outline': lucideIcon(Download),
    'edit-2-outline': lucideIcon(Edit2),
    'email-outline': lucideIcon(Mail),
    'external-link-outline': lucideIcon(ExternalLink),
    'file-text-outline': lucideIcon(FileText),
    'flag-outline': lucideIcon(Flag),
    'flash-outline': lucideIcon(Zap),
    'gift-outline': lucideIcon(Gift),
    'globe-2-outline': lucideIcon(Globe2),
    'globe-outline': lucideIcon(Globe),
    'grid-outline': lucideIcon(Grid),
    'headphones-outline': lucideIcon(Headphones),
    'heart-outline': lucideIcon(Heart),
    'home-outline': lucideIcon(Home),
    'inbox-outline': lucideIcon(Inbox),
    'info-outline': lucideIcon(Info),
    'lock-outline': lucideIcon(Lock),
    'log-in-outline': lucideIcon(LogIn),
    'log-out-outline': lucideIcon(LogOut),
    'message-circle-outline': lucideIcon(MessageCircle),
    'message-square-outline': lucideIcon(MessageSquare),
    'mic-outline': lucideIcon(Mic),
    'people-outline': lucideIcon(Users),
    'percent-outline': lucideIcon(Percent),
    'person-outline': lucideIcon(User),
    person: lucideIcon(User),
    'pie-chart-outline': lucideIcon(PieChart),
    'pin-outline': lucideIcon(Pin),
    'play-circle-outline': lucideIcon(PlayCircle),
    'plus-circle-outline': lucideIcon(PlusCircle),
    'plus-outline': lucideIcon(Plus),
    'radio-button-off-outline': lucideIcon(Circle),
    'radio-button-on-outline': lucideIcon(CircleDot),
    'radio-outline': lucideIcon(Radio),
    'refresh-outline': lucideIcon(RefreshCw),
    'search-outline': lucideIcon(Search),
    'settings-2-outline': lucideIcon(Settings2),
    'share-outline': lucideIcon(Share2),
    'shield-outline': lucideIcon(Shield),
    'star-outline': lucideIcon(Star),
    // Filled variant — was missing entirely, meaning EVERY filled-star
    // render (components/AppRatingModal.tsx's tap-to-rate picker, and now
    // also components/StarRating.tsx used across MyRatings/InterviewFeedback
    // /PracticalScenarioFeedback/SharedContentDetail) would throw this
    // exact "icon not registered" crash the moment a star was actually
    // filled in — e.g. AppRatingModal as soon as the user tapped a star.
    star: lucideIcon(Star, true),
    'sun-outline': lucideIcon(Sun),
    'swap-outline': lucideIcon(ArrowLeftRight),
    'trash-2-outline': lucideIcon(Trash2),
    'trending-up-outline': lucideIcon(TrendingUp),
    // Filled — Leaderboard.tsx's #1 podium spot ("add a yellow trophy svg
    // there to show who is leading").
    trophy: lucideIcon(Trophy, true),
    'trophy-outline': lucideIcon(Trophy),
    'upload-outline': lucideIcon(Upload),
    'video-off-outline': lucideIcon(VideoOff),
    'video-outline': lucideIcon(Video),
    'volume-up-outline': lucideIcon(Volume2),
  },
};

export default LucideEvaIconsPack;
