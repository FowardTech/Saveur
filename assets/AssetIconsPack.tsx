import {IconPack} from '@ui-kitten/components';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Baby,
  Banknote,
  Bell,
  Bookmark,
  Briefcase,
  CalendarPlus,
  Calendar,
  Camera,
  Car,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  CreditCard,
  Crown,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flame,
  Footprints,
  GraduationCap,
  GripVertical,
  HeartHandshake,
  HeartPulse,
  History,
  Home,
  Image,
  ImagePlus,
  Map,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  MoreHorizontal,
  MoreVertical,
  Moon,
  Paperclip,
  PawPrint,
  Pencil,
  Phone,
  PhoneOff,
  Plus,
  Quote,
  Repeat,
  RotateCcw,
  ScanFace,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Star,
  ThumbsUp,
  TrendingUp,
  Trash2,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Video,
  VideoOff,
  X,
  Zap,
} from 'lucide-react-native';
import {lucideIcon} from './lucideIcon';

// Every icon in this app used to be a raster PNG (see assets/icons/index.ts)
// rendered through a plain <Image>. Per explicit product direction ("use the
// icon style you used in the admin dashboard -- lucide-react -- in this
// mobile app... including the tabs and settings"), this pack now renders
// lucide-react-native vector icons instead, one per key -- see
// lucideIcon.tsx for the adapter that makes this a drop-in swap requiring
// NO changes at any <Icon pack="assets" name="..."/> call site anywhere in
// the app (tab bar, Settings/More, every screen). Keys match assets/
// icons/index.ts's PNG keys 1:1 so nothing needed renaming; assets/icons/
// index.ts itself is no longer imported here (or anywhere reachable from
// this pack) now that nothing in it is actually rendered through it, but
// the PNG files/that module are left in place rather than deleted, in case
// anything elsewhere still imports Icons.* directly for a non-Icon-pack use
// (e.g. a raw <Image source={Icons.x}/>).
//
// Many of these keys (toddler/preSchool/junior/infant/petCare/seniorCare/
// housekeeping/nanny/bgCheckEnhanced/vehicleCheck/first_aid/cpr/etc.) are
// leftovers from the childcare-marketplace template this app was rebuilt
// from ("Caren") and are not known to be rendered by any current Saveur
// screen -- mapped anyway (to the closest reasonable Lucide icon) so nothing
// regresses if a currently-dead code path turns out to still reference one.
const AssetIconsPack: IconPack<any> = {
  name: 'assets',
  icons: {
    back: lucideIcon(ArrowLeft),
    // Product request: More/Settings list rows' trailing icon changed from a
    // full arrow (arrowRight, below) to a plain chevron — thinner, no
    // shaft/tail, the conventional "this row navigates deeper" affordance
    // most settings lists use (matches the reference screenshot). arrowRight
    // itself is left in place since other call sites still use it for
    // "go/continue" actions, which are a different affordance than "this
    // opens a sub-screen".
    chevronRight: lucideIcon(ChevronRight),
    eyeOff: lucideIcon(EyeOff),
    eyeOn: lucideIcon(Eye),
    map: lucideIcon(Map),
    close: lucideIcon(X),
    currentLocation: lucideIcon(MapPin),
    filter: lucideIcon(Filter),
    pinMap: lucideIcon(MapPin),
    trash: lucideIcon(Trash2),
    camera: lucideIcon(Camera),
    option: lucideIcon(MoreVertical),
    photoLibrary: lucideIcon(Image),
    addMore: lucideIcon(Plus),
    bookmark: lucideIcon(Bookmark),
    bookmarkActive: lucideIcon(Bookmark, true),
    calendar: lucideIcon(Calendar),
    calendarActive: lucideIcon(Calendar, true),
    comment: lucideIcon(MessageCircle),
    commentActive: lucideIcon(MessageCircle, true),
    more: lucideIcon(MoreHorizontal),
    moreActive: lucideIcon(MoreHorizontal, true),
    search: lucideIcon(Search),
    searchActive: lucideIcon(Search),
    send: lucideIcon(Send),
    setting: lucideIcon(Settings),
    // Brand logos -- lucide-react (and lucide-react-native) dropped
    // trademarked brand marks entirely some versions back, and these three
    // custom keys aren't actually rendered anywhere in the current app (see
    // module comment above) -- generic neutral fallback rather than
    // spending a bespoke icon choice on dead code.
    twitter: lucideIcon(Share2),
    facebook: lucideIcon(Share2),
    instagram: lucideIcon(Share2),
    dollar: lucideIcon(DollarSign),
    minus: lucideIcon(Minus),
    plus: lucideIcon(Plus),
    // Home's StatStrip icon badges (product request: "give this guys some
    // illustration icons" -- Step/Streak/XP tiles). Flame reads as the
    // conventional "streak" glyph (Duolingo etc.); Footprints as "steps
    // along a path" for the roadmap-step tile -- see StatStrip.tsx/
    // HomeSrc.tsx's own call site for how these render (tinted white on a
    // per-stat gradient chip).
    streak: lucideIcon(Flame),
    step: lucideIcon(Footprints),
    tutoring: lucideIcon(GraduationCap),
    infant: lucideIcon(Baby),
    junior: lucideIcon(GraduationCap),
    preSchool: lucideIcon(Baby),
    toddler: lucideIcon(Baby),
    quote: lucideIcon(Quote),
    bgCheck: lucideIcon(ShieldCheck),
    bgCheckEnhanced: lucideIcon(ShieldCheck),
    vehicleCheck: lucideIcon(Car),
    master: lucideIcon(Crown),
    radioActive: lucideIcon(CircleDot),
    arrowRight: lucideIcon(ArrowRight),
    plusImg: lucideIcon(ImagePlus),
    resetSearch: lucideIcon(RotateCcw),
    onlineState: lucideIcon(Circle),
    location16: lucideIcon(MapPin),
    baby: lucideIcon(Baby),
    babyActive: lucideIcon(Baby, true),
    premiumAcc: lucideIcon(Crown),
    attach: lucideIcon(Paperclip),
    call: lucideIcon(Phone),
    payment: lucideIcon(CreditCard),
    videoOff: lucideIcon(VideoOff),
    videoOn: lucideIcon(Video),
    callOff: lucideIcon(PhoneOff),
    mute: lucideIcon(MicOff),
    interview: lucideIcon(Mic),
    callSmall: lucideIcon(Phone),
    messageSmall: lucideIcon(MessageCircle),
    calendarRequest: lucideIcon(Calendar),
    time: lucideIcon(Clock),
    notification: lucideIcon(Bell),
    myPost: lucideIcon(FileText),
    stats: lucideIcon(TrendingUp),
    changeJob: lucideIcon(Briefcase),
    helpWhite: lucideIcon(FileText),
    term: lucideIcon(FileText),
    darkMode: lucideIcon(Moon),
    share: lucideIcon(Share2),
    male: lucideIcon(User),
    female: lucideIcon(User),
    homeActive: lucideIcon(Home, true),
    home: lucideIcon(Home),
    rateFull: lucideIcon(Star),
    hourlyRate: lucideIcon(Clock),
    carePro: lucideIcon(Award),
    edit: lucideIcon(Pencil),
    searchHistory: lucideIcon(History),
    petCare: lucideIcon(PawPrint),
    specialNeeds: lucideIcon(HeartHandshake),
    seniorCare: lucideIcon(UserCheck),
    housekeeping: lucideIcon(Home),
    increase: lucideIcon(TrendingUp),
    // AI Career Twin (src/more/AICareerTwin.tsx) — a scan/identity-capture
    // glyph fits the "your aggregated profile" concept better than a plain
    // person icon, and isn't already used elsewhere in this pack.
    aiCareerTwin: lucideIcon(ScanFace),
    like_comment: lucideIcon(ThumbsUp),
    like_comment_active: lucideIcon(ThumbsUp, true),
    first_aid: lucideIcon(HeartPulse),
    cpr: lucideIcon(HeartPulse),
    add_plan: lucideIcon(CalendarPlus),
    edit_full: lucideIcon(Pencil),
    handle: lucideIcon(GripVertical),
    occasional: lucideIcon(Repeat),
    one_time: lucideIcon(Circle),
    regular_schedule: lucideIcon(Repeat),
    nanny: lucideIcon(UserPlus),
    asap: lucideIcon(Zap),
    add: lucideIcon(Plus),
    credit: lucideIcon(CreditCard),
    cash: lucideIcon(Banknote),
    security: lucideIcon(Shield),
    edit_profile: lucideIcon(UserCog),
  },
};

export default AssetIconsPack;
