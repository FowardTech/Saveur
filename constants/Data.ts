import {Images} from 'assets/images';
import {IMessage} from 'react-native-gifted-chat';
import {
  Gender_Type,
  MessagesItemProps,
  Onl_State_Types_Enum,
  Request_Status_Type_Enum,
  Request_Type_Enum,
  UserProps,
  Application_Stage_Enum,
  JobApplicationProps,
  Interview_Type_Enum,
  Practice_Mode_Enum,
  Difficulty_Enum,
  MockInterviewSessionProps,
  SkillScoreProps,
  BadgeDefinitionProps,
  NetworkingContactProps,
} from './Types';

export const MY_RECOMMENDED: UserProps[] = [
  {
    id: '1',
    name: 'Edith Johnson',
    avatar: Images.avatar1,
    onlineState: Onl_State_Types_Enum.JustLeave,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    age: 28,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: '1',
    name: 'Christina McLaughlin',
    avatar: Images.avatar2,
    onlineState: Onl_State_Types_Enum.Offline,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    age: 28,
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: '1',
    name: 'Harvey McLaughlin ',
    avatar: Images.avatar9,
    onlineState: Onl_State_Types_Enum.Online,
    gender: Gender_Type.Male,
    experience: '8 yrs',
    age: 24,

    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: '1',
    name: 'Christina Ramsey',
    avatar: Images.avatar4,
    onlineState: Onl_State_Types_Enum.JustLeave,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    age: 20,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: '1',
    name: 'Lincoln Harper',
    avatar: Images.avatar5,
    onlineState: Onl_State_Types_Enum.Online,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    age: 25,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
];
export const MY_FAVORITES: UserProps[] = [
  {
    id: '1',
    name: 'Victoria Lander',
    avatar: Images.avatar1,
    onlineState: Onl_State_Types_Enum.JustLeave,
    age: 24,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: '2',
    name: 'Sophia Johnson',
    avatar: Images.avatar2,
    onlineState: Onl_State_Types_Enum.Offline,
    age: 24,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.767734,
      longitude: -122.416417,
    },
  },
  {
    id: '3',
    name: 'Harvey Mclaughlin',
    avatar: Images.avatar3,
    onlineState: Onl_State_Types_Enum.Online,
    age: 24,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.774034,
      longitude: -122.399417,
    },
  },
  {
    id: '4',
    name: 'Christina Harvey',
    avatar: Images.avatar4,
    onlineState: Onl_State_Types_Enum.JustLeave,
    age: 24,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.795934,
      longitude: -122.406417,
    },
  },
  {
    id: '5',
    name: 'Edith Johnson',
    avatar: Images.avatar10,
    onlineState: Onl_State_Types_Enum.Online,
    age: 24,
    gender: Gender_Type.Female,
    experience: '6 yrs',
    backgroundCheck: true,
    carePro: true,
    rate: 4.85,
    address: 'Boston, NY',
    distance: '2 miles',
    reviews: 214,
    hourlyRate: '$15-$20/hr',
    cared: 192,
    mapLocation: {
      latitude: 37.7915934,
      longitude: -122.406417,
    },
  },
];

export const RECOMMEND_DATA = [
  {
    id: 0,
    name: 'Marian Ramsey',
    title: 'Regular afterschool child caregiver needed.',
    children: 1,
    online: true,
    avatar: Images.avatar1,
    ageType: 'Toddler, Junior-High',
    location: 'Rochester, NY',
    startTime: 'Tue, Otc 14',
    hour: '08:00 - 12:00',
    applicants: 2,
    price: '$15-$25/hr',
    howOften: 'Regularly',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    mile: 2,
    mapLocation: {
      latitude: 37.793434,
      longitude: -122.413417,
    },
  },
  {
    id: 1,
    name: 'Emily Clark',
    title: 'Babysitting for a few hours',
    children: 2,
    online: false,
    avatar: Images.avatar2,
    ageType: 'Toddler',
    location: 'Manhattan, NY',
    startTime: 'Tue, Otc 14',
    hour: 'Flexible',
    applicants: 2,
    price: '$15-$25/hr',
    howOften: 'Occasional',
    mile: 2,
    mapLocation: {
      latitude: 37.767734,
      longitude: -122.416417,
    },
  },
  {
    id: 2,
    name: 'Mattie Harper',
    title: 'Babysitting for two hours',
    children: 1,
    online: true,
    avatar: Images.avatar3,
    ageType: 'Toddler',
    location: 'Manhattan, NY',
    startTime: 'Tue, Otc 14',
    hour: 'Flexible',
    applicants: 2,
    price: '$15-$25/hr',
    howOften: 'Occasional',
    mile: 3,
    mapLocation: {
      latitude: 37.774034,
      longitude: -122.399417,
    },
  },
  {
    id: 3,
    name: 'Nina McGuire',
    title: 'Babysitting for two hours',
    children: 1,
    online: true,
    avatar: Images.avatar4,
    ageType: 'Toddler',
    location: 'Manhattan, NY',
    startTime: 'Tue, Otc 14',
    hour: 'Flexible',
    applicants: 2,
    price: '$15-$25/hr',
    howOften: 'Occasional',
    mile: 3,
    mapLocation: {
      latitude: 37.795934,
      longitude: -122.406417,
    },
  },
];
export const DATA_TYPE_OF_CARE = [
  {title: 'Occasional', ex: 'Backup care', icon: 'occasional'},
  {
    title: 'Regularly Scheduled',
    ex: 'After school',
    icon: 'regular_schedule',
  },
  {title: 'One time', ex: 'Upcoming event', icon: 'one_time'},
  {title: 'Nanny', ex: 'Backup care', icon: 'nanny'},
  {title: 'Need ASAP', ex: 'Urgent event', icon: 'asap'},
];

export const DATA_CHAT: IMessage[] = [
  {
    _id: 0,
    createdAt: new Date(),
    text: 'Yup! I love it! 😍',
    user: {
      _id: 2,
      name: 'React Native',
      avatar: Images.avatar1,
    },
  },
  {
    _id: 2,
    /* @ts-ignore */
    text: null,
    image: 'https://i.ibb.co/T1GZtfv/bg.png',
    createdAt: 1644919257000,
    user: {
      _id: 1,
      name: 'React Native',
      avatar: Images.avatar,
    },
  },
  {
    _id: 1,
    text: '😍 Thank you so much!',
    createdAt: 1644919257000,
    user: {
      _id: 1,
      name: 'React Native',
      avatar: Images.avatar,
    },
  },

  {
    _id: 3,
    text: `Hi Mattie. That’s great! 😍 Thanks so much for lettering me know.`,
    createdAt: 1644515257000,
    user: {
      _id: 2,
      name: 'React Native',
      avatar: Images.avatar1,
    },
  },
  {
    _id: 5,
    createdAt: 1646919257000,
    text: `Hi Marian. We’re having a great day! John eat all of his lunch!`,
    user: {
      _id: 1,
      name: 'React Native',
      avatar: Images.avatar,
    },
  },
];
// AI Coach chat threads (TODO: replace with real assistant/session data).
export const DATA_MESSAGES: MessagesItemProps[] = [
  {
    id: 0,
    name: 'AI Career Coach',
    title: 'Great work on your Behavioral round — want to review it?',
    readed: false,
    time: '09:40',
    isWeb: false,
    onlineState: Onl_State_Types_Enum.Online,
    avatar: Images.logo,
  },
  {
    id: 1,
    name: 'Resume Review',
    title: 'Your ATS score improved to 82% after the last edit.',
    readed: true,
    time: '09:40',
    isWeb: true,
    onlineState: Onl_State_Types_Enum.Online,
    avatar: Images.logo,
  },
  {
    id: 2,
    name: 'Mock Interview Debrief',
    title: 'Here are 3 ways to strengthen your STAR answers.',
    readed: true,
    time: 'Mon',
    isWeb: false,
    onlineState: Onl_State_Types_Enum.Online,
    avatar: Images.logo,
  },
  {
    id: 3,
    name: 'Salary Negotiation Tips',
    title: 'Ready to talk through your offer strategy?',
    readed: true,
    time: 'Oct 2',
    isWeb: false,
    onlineState: Onl_State_Types_Enum.Online,
    avatar: Images.logo,
  },
];
export const DATA_PAST_INTERVIEW = [
  {
    id: 0,
    name: 'Ann Nash',
    time: 1570496225000,
    dateIn: '17:00 - 17:30',
    type: Request_Status_Type_Enum.Completed,
    avatar: Images.avatar,
    status: Onl_State_Types_Enum.Online,
  },
  {
    id: 1,
    name: 'Marian Ramsey',
    time: 1569718625000,
    dateIn: '18:00 - 18:30',
    type: Request_Status_Type_Enum.Accepted,
    avatar: Images.avatar1,
    status: Onl_State_Types_Enum.Online,
  },
  {
    id: 2,
    name: 'Lela Ramos',
    time: 1567385825000,
    dateIn: '11:00 - 11:30',
    type: Request_Status_Type_Enum.Completed,
    avatar: Images.avatar4,
    status: Onl_State_Types_Enum.Offline,
  },
  {
    id: 3,
    name: 'Ida Grant',
    time: 1567385825000,
    dateIn: '15:00 - 15:30',
    type: Request_Status_Type_Enum.Declined,
    avatar: Images.avatar5,
    status: Onl_State_Types_Enum.Online,
  },
  {
    id: 3,
    name: 'Ida Grant',
    time: 1567385825000,
    dateIn: '15:00 - 15:30',
    type: Request_Status_Type_Enum.Canceled,
    avatar: Images.avatar7,
    status: Onl_State_Types_Enum.Online,
  },
  {
    id: 3,
    name: 'Josie Andrews',
    time: 1567385825000,
    dateIn: '15:00 - 15:30',
    type: Request_Status_Type_Enum.Declined,
    avatar: Images.avatar8,
    status: Onl_State_Types_Enum.Online,
  },
];
export const DATA_CURRENT_INTERVIEW = [
  {
    id: 0,
    name: 'Christine Bradley',
    time: new Date(),
    dateIn: '17:00 - 17:30',
    type: Request_Status_Type_Enum.Accepted,
    avatar: Images.avatar2,
    status: Onl_State_Types_Enum.Online,
  },
  {
    id: 1,
    name: 'Lily McGee',
    time: new Date(),
    dateIn: '18:00 - 18:30',
    type: Request_Status_Type_Enum.Completed,
    avatar: Images.avatar3,
    status: Onl_State_Types_Enum.Offline,
  },
  {
    id: 1,
    name: 'Lily Paris',
    time: new Date(),
    dateIn: '12:00 - 12:30',
    type: Request_Status_Type_Enum.Unconfirmed,
    avatar: Images.avatar,
    status: Onl_State_Types_Enum.Offline,
  },
];
export const DATA_CURRENT_BOOKING = [
  {
    user: MY_FAVORITES[1],
    onlineState: Onl_State_Types_Enum.JustLeave,
    type: Request_Status_Type_Enum.Unconfirmed,
    children: ['John'],
    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '08:00 - 12:00',
    location: 'Rochester, NY',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
];
export const DATA_PASS_BOOKING = [
  {
    user: MY_FAVORITES[0],
    onlineState: Onl_State_Types_Enum.JustLeave,
    type: Request_Status_Type_Enum.Completed,
    children: ['John'],

    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '08:00 - 12:00',
    location: 'Rochester, NY',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
  {
    user: MY_FAVORITES[3],
    onlineState: Onl_State_Types_Enum.Online,
    type: Request_Status_Type_Enum.Accepted,
    children: ['John'],

    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '09:00 - 09:30',
    location: 'Rochester, NY',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: true,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: true,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
];
export const DATA_CURRENT_APPLICATION = [
  {
    user: MY_FAVORITES[0],
    onlineState: Onl_State_Types_Enum.JustLeave,
    type: Request_Status_Type_Enum.Unconfirmed,
    children: ['John'],
    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '08:00 - 12:00',
    location: 'Rochester, NY',
    jobDescription: 'Regular afterschool child caregiver needed.',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
];
export const DATA_PASS_APPLICATION = [
  {
    user: MY_FAVORITES[2],
    onlineState: Onl_State_Types_Enum.JustLeave,
    type: Request_Status_Type_Enum.Accepted,
    children: ['John'],

    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '08:00 - 12:00',
    location: 'Rochester, NY',
    jobDescription: 'Babysitting for a few hours in weekdays.',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
  {
    user: MY_FAVORITES[1],
    onlineState: Onl_State_Types_Enum.Online,
    type: Request_Status_Type_Enum.Declined,
    children: ['John'],

    mile: 2,
    ageType: 'Toddler',
    startTime: new Date(),
    meetingTime: '08:00 - 12:00',
    location: 'Rochester, NY',
    jobDescription: 'Babysitting for a few hours in weekdays.',
    dayInWeek: [
      {
        title: 'Sun',
        isActive: false,
      },
      {
        title: 'Mon',
        isActive: false,
      },
      {
        title: 'Tue',
        isActive: true,
      },
      {
        title: 'Wed',
        isActive: true,
      },
      {
        title: 'Thu',
        isActive: true,
      },
      {
        title: 'Fri',
        isActive: false,
      },
      {
        title: 'Sat',
        isActive: false,
      },
    ],
    price: '$15-$20/hr',
  },
];
export const ABILITY_DATA = [
  {
    id: 0,
    date: 1648647101000,
    title: 'March 30 - April 6 ',
  },
  {
    id: 1,
    type: Request_Type_Enum.Interview,
    date: 1649338301000,
    meeting_time: '17:00 - 17:30',
    title: 'April 7 - 13',
    user: MY_FAVORITES[0],
  },
  {
    id: 2,
    type: Request_Type_Enum.Interview,
    date: 1649943101000,
    meeting_time: '12:00 - 12:30',
    title: 'April 14 - 20',
    user: MY_FAVORITES[2],
  },
  {
    id: 3,
    date: 1650547901000,
    title: 'April 21 - 27',
  },
  {
    id: 4,
    date: 1651152701000,
    title: 'April 28 - May 4',
  },
];
// ---- AI Interview Coach mock data (TODO: replace with real backend data) ----
export const DATA_APPLICATIONS_ACTIVE: JobApplicationProps[] = [
  {
    id: 0,
    company: 'Nimbus Analytics',
    role: 'Product Manager',
    location: 'Remote - US',
    logo: Images.avatar1,
    appliedDate: 1718649600000,
    stage: Application_Stage_Enum.Interviewing,
    nextStep: 'Final round on Fri, Aug 2',
  },
  {
    id: 1,
    company: 'Brightpath Health',
    role: 'Customer Success Lead',
    location: 'Boston, MA',
    logo: Images.avatar2,
    appliedDate: 1719340800000,
    stage: Application_Stage_Enum.Applied,
    nextStep: 'Awaiting recruiter response',
  },
  {
    id: 2,
    company: 'Solace Robotics',
    role: 'Software Engineer, Backend',
    location: 'Remote - Global',
    logo: Images.avatar3,
    appliedDate: 1719945600000,
    stage: Application_Stage_Enum.Applied,
    nextStep: 'Awaiting recruiter response',
  },
];
export const DATA_APPLICATIONS_CLOSED: JobApplicationProps[] = [
  {
    id: 3,
    company: 'Lark & Co Consulting',
    role: 'Associate Consultant',
    location: 'Chicago, IL',
    logo: Images.avatar4,
    appliedDate: 1716230400000,
    stage: Application_Stage_Enum.Offer,
    nextStep: 'Offer expires Aug 10',
  },
  {
    id: 4,
    company: 'Fieldstone Retail',
    role: 'Marketing Coordinator',
    location: 'Austin, TX',
    logo: Images.avatar5,
    appliedDate: 1714780800000,
    stage: Application_Stage_Enum.Rejected,
  },
];

// Icons here used to mix the custom "assets" PNG pack's filled/badge-style
// glyphs (e.g. premiumAcc, first_aid — solid art with their own baked-in
// rounded-square backgrounds) with a few genuinely thin-stroke ones from the
// same pack (edit, comment) — tinting a filled PNG doesn't turn it into an
// outline, so those read as visually "bold" next to the line-art ones (the
// inconsistency reported on the Practice screen). Standardized on eva's
// outline icon set throughout instead, since every eva icon has a matching
// `-outline` variant, guaranteeing a uniform line-art look — see FindScreen
// where these are now rendered with `pack="eva"` rather than "assets". Also
// de-duplicated icons that were previously reused across unrelated
// categories (e.g. 'stats' appeared 3x, 'edit_full' 2x).
export const DATA_INTERVIEW_TYPES = [
  {type: Interview_Type_Enum.Behavioral, icon: 'message-square-outline'},
  {type: Interview_Type_Enum.Technical, icon: 'settings-2-outline'},
  {type: Interview_Type_Enum.Coding, icon: 'code-outline'},
  {type: Interview_Type_Enum.SystemDesign, icon: 'grid-outline'},
  {type: Interview_Type_Enum.ProductManagement, icon: 'briefcase-outline'},
  {type: Interview_Type_Enum.Sales, icon: 'trending-up-outline'},
  {type: Interview_Type_Enum.Marketing, icon: 'pie-chart-outline'},
  {type: Interview_Type_Enum.Finance, icon: 'credit-card-outline'},
  {type: Interview_Type_Enum.Healthcare, icon: 'heart-outline'},
  {type: Interview_Type_Enum.CustomerService, icon: 'headphones-outline'},
  {type: Interview_Type_Enum.Government, icon: 'shield-outline'},
  {type: Interview_Type_Enum.Consulting, icon: 'bulb-outline'},
  {type: Interview_Type_Enum.Executive, icon: 'award-outline'},
  {type: Interview_Type_Enum.Graduate, icon: 'book-open-outline'},
  {type: Interview_Type_Enum.Internship, icon: 'clipboard-outline'},
  {type: Interview_Type_Enum.Sports, icon: 'activity-outline'},
];
export const DATA_PRACTICE_MODES = [
  {mode: Practice_Mode_Enum.Voice, icon: 'call', description: 'Speak your answers, get spoken feedback'},
  {mode: Practice_Mode_Enum.Text, icon: 'edit', description: 'Type your answers at your own pace'},
  {mode: Practice_Mode_Enum.Video, icon: 'videoOn', description: 'Practice on camera like a real interview'},
];
export const DATA_DIFFICULTY = [
  Difficulty_Enum.Beginner,
  Difficulty_Enum.Intermediate,
  Difficulty_Enum.Advanced,
];

export const DATA_UPCOMING_SESSIONS: MockInterviewSessionProps[] = [
  {
    id: 0,
    interviewType: Interview_Type_Enum.SystemDesign,
    mode: Practice_Mode_Enum.Video,
    difficulty: Difficulty_Enum.Advanced,
    date: new Date(),
    durationMin: 45,
    status: 'Scheduled',
  },
];
export const DATA_PAST_SESSIONS: MockInterviewSessionProps[] = [
  {
    id: 1,
    interviewType: Interview_Type_Enum.Behavioral,
    mode: Practice_Mode_Enum.Voice,
    difficulty: Difficulty_Enum.Intermediate,
    date: 1719340800000,
    durationMin: 30,
    overallScore: 82,
    status: 'Completed',
  },
  {
    id: 2,
    interviewType: Interview_Type_Enum.Technical,
    mode: Practice_Mode_Enum.Text,
    difficulty: Difficulty_Enum.Intermediate,
    date: 1718649600000,
    durationMin: 25,
    overallScore: 74,
    status: 'Completed',
  },
  {
    id: 3,
    interviewType: Interview_Type_Enum.Coding,
    mode: Practice_Mode_Enum.Video,
    difficulty: Difficulty_Enum.Advanced,
    date: 1717440000000,
    durationMin: 50,
    overallScore: 68,
    status: 'Completed',
  },
];

export const DATA_FEEDBACK_SCORES: SkillScoreProps[] = [
  {label: 'Confidence', score: 78},
  {label: 'Communication', score: 85},
  {label: 'Technical Skill', score: 71},
  {label: 'Leadership', score: 66},
  {label: 'Problem Solving', score: 80},
  {label: 'Creativity', score: 74},
  {label: 'Critical Thinking', score: 77},
];
export const DATA_STAR_BREAKDOWN = [
  {
    letter: 'S',
    label: 'Situation',
    score: 80,
    note: 'Clearly set the scene, could add more context on constraints.',
  },
  {
    letter: 'T',
    label: 'Task',
    score: 75,
    note: 'Goal was clear, ownership could be stated more directly.',
  },
  {
    letter: 'A',
    label: 'Action',
    score: 82,
    note: 'Good detail on steps taken, nice use of specific tools.',
  },
  {
    letter: 'R',
    label: 'Result',
    score: 70,
    note: 'Add a measurable outcome (%, $, time saved) to strengthen this.',
  },
];

export const DATA_WEEKLY_PRACTICE = [
  {day: 'Mon', sessions: 1},
  {day: 'Tue', sessions: 2},
  {day: 'Wed', sessions: 0},
  {day: 'Thu', sessions: 1},
  {day: 'Fri', sessions: 3},
  {day: 'Sat', sessions: 0},
  {day: 'Sun', sessions: 1},
];

export const DATA_PAYMENT = [
  {
    id: 0,
    nameCard: 'Master Card',
    last4number: 5689,
  },
  {
    id: 1,
    nameCard: 'Master Card',
    last4number: 6497,
  },
  {
    id: 2,
    nameCard: 'Master Card',
    last4number: 2344,
  },
  {
    id: 3,
    nameCard: 'American Express',
    last4number: 1989,
  },
];

// ---- AI Interview Coach additions (adaptive follow-up question bank) ----
// Backs LiveInterviewSession.tsx's adaptive-question flow — a few questions
// per interview type so a session doesn't just repeat the same single
// prompt for its whole duration. TODO: a real backend/LLM would generate
// these dynamically based on the candidate's previous answer instead of
// cycling through a fixed, pre-written bank.
export const DATA_INTERVIEW_QUESTION_BANK: Record<Interview_Type_Enum, string[]> = {
  [Interview_Type_Enum.Behavioral]: [
    'Tell me about a time you had to resolve a conflict within your team.',
    'Describe a situation where you had to meet a tight deadline. What did you do?',
    'Tell me about a time you received difficult feedback. How did you respond?',
    'Give an example of a time you took initiative without being asked.',
  ],
  [Interview_Type_Enum.Technical]: [
    'Walk me through how you would design a rate limiter.',
    'Explain the tradeoffs between SQL and NoSQL databases for a high-traffic app.',
    'How would you debug a production API endpoint that suddenly got slower?',
    'Walk me through how you would design a caching layer for a read-heavy service.',
  ],
  [Interview_Type_Enum.Coding]: [
    'How would you find the two numbers in an array that add up to a target value?',
    'How would you detect a cycle in a linked list?',
    'How would you design an algorithm to find the longest substring without repeating characters?',
  ],
  [Interview_Type_Enum.SystemDesign]: [
    'How would you design a URL shortening service that scales to millions of users?',
    'How would you design the backend for a real-time chat application?',
    'How would you design a news-feed ranking system?',
    'How would you shard a database that has outgrown a single instance?',
  ],
  [Interview_Type_Enum.ProductManagement]: [
    'How would you prioritize a roadmap with limited engineering resources?',
    'Walk me through how you would launch a feature that early users are ignoring.',
    'How would you decide whether to build vs. buy a capability?',
    'Tell me about a product decision you made with incomplete data.',
  ],
  [Interview_Type_Enum.Sales]: [
    'Tell me about a time you turned around a lost deal.',
    'How do you handle a prospect who keeps pushing back on price?',
    'Walk me through how you qualify a lead in the first call.',
  ],
  [Interview_Type_Enum.Marketing]: [
    'How would you launch a new product with a limited budget?',
    'How would you measure the success of a brand awareness campaign?',
    'Tell me about a campaign that underperformed. What did you learn?',
  ],
  [Interview_Type_Enum.Finance]: [
    'Walk me through how you would value a company with no earnings yet.',
    'How would you explain the three financial statements to a non-finance person?',
    'Walk me through a DCF at a high level.',
  ],
  [Interview_Type_Enum.Healthcare]: [
    'Describe a time you had to make a difficult decision under pressure with a patient.',
    'How do you stay current with best practices in your specialty?',
    'Tell me about a time you had to communicate bad news with empathy.',
  ],
  [Interview_Type_Enum.CustomerService]: [
    'Tell me about a time you turned an upset customer into a happy one.',
    'How do you handle a customer who is asking for something outside policy?',
    'Describe a time you had to say no to a customer. How did you do it?',
  ],
  [Interview_Type_Enum.Government]: [
    'How would you balance competing stakeholder interests on a public project?',
    'Tell me about a time you had to explain a policy change to the public.',
    'How do you approach a decision that affects a community you don’t belong to?',
  ],
  [Interview_Type_Enum.Consulting]: [
    'How would you estimate the market size for electric scooters in a new city?',
    'A client’s revenue is declining — how would you structure your diagnosis?',
    'How would you advise a retailer deciding whether to expand internationally?',
  ],
  [Interview_Type_Enum.Executive]: [
    'Tell me about a time you had to make a decision that wasn’t popular with your team.',
    'How do you build alignment across leaders with competing priorities?',
    'Describe a time you had to change strategy mid-course. What triggered it?',
  ],
  [Interview_Type_Enum.Graduate]: [
    'Why are you interested in starting your career with us?',
    'Tell me about a group project where not everyone contributed equally.',
    'What’s something you learned outside of the classroom that shaped how you work?',
  ],
  [Interview_Type_Enum.Internship]: [
    'Tell me about a project you’re proud of from school.',
    'What do you hope to learn during this internship?',
    'Describe a time you had to teach yourself something quickly.',
  ],
  [Interview_Type_Enum.Sports]: [
    'Tell me about a time you had to perform under pressure in front of an audience or during a big game.',
    'How do you handle a disagreement with a coach or teammate about strategy?',
    'Describe a time you had to recover mentally from a loss or a bad performance.',
    'How do you balance training, competition, and life outside of sport?',
  ],
};

// ---- AI Interview Coach additions (company-specific prep) ----
// Backs MockInterviewSetup's company picker — purely for flavoring question
// copy (see LiveInterviewSession.tsx) today. TODO: a real backend could swap
// this for actual company-specific question packs / interview-process notes.
export const DATA_COMPANIES: string[] = [
  'Google',
  'Amazon',
  'Microsoft',
  'Meta',
  'Apple',
  'Netflix',
  'Stripe',
  'Airbnb',
  'Uber',
  'Salesforce',
  'Goldman Sachs',
  'JPMorgan Chase',
  'Morgan Stanley',
  'McKinsey & Company',
  'Boston Consulting Group',
  'Bain & Company',
  'Deloitte',
  'PwC',
  'Johnson & Johnson',
  'Procter & Gamble',
];
export const COMPANY_ANY = 'Other / Any Company';

// Product report: "the company list in the interview setup is very US-
// centric — a user outside the US should see companies that are actually
// relevant to them too." DATA_COMPANIES above is a fine global-mega-cap
// default (and stays as the always-shown base list — a US Big Tech
// question set is still broadly useful prep for anyone), but it's the
// ENTIRE list today regardless of where the user actually is.
//
// Grouped by region rather than one list per country: the same curated set
// of prominent, real employers is genuinely relevant across neighboring
// countries (e.g. someone in Portugal and someone in Switzerland both
// plausibly interview with SAP or Nestlé), and a full 71-country x
// N-companies matrix would be unmaintainable and mostly duplicate entries
// anyway. REGION_BY_COUNTRY maps every real entry in constants/countries.ts's
// COUNTRIES (the exact same list SignupSecondStep/JobPreferences.tsx already
// collect preferredCountries from) to one of these regions; the synthetic
// "Remote - Anywhere" entry has no region and is simply skipped (falls back
// to the base DATA_COMPANIES list with nothing added, same as today).
export type CompanyRegion =
  | 'north_america'
  | 'uk_ireland'
  | 'western_europe'
  | 'nordics'
  | 'eastern_europe'
  | 'anz'
  | 'southeast_asia'
  | 'east_asia'
  | 'south_asia'
  | 'middle_east'
  | 'africa'
  | 'latin_america';

export const REGION_BY_COUNTRY: Record<string, CompanyRegion> = {
  'United States': 'north_america',
  Canada: 'north_america',
  'United Kingdom': 'uk_ireland',
  Ireland: 'uk_ireland',
  Germany: 'western_europe',
  France: 'western_europe',
  Spain: 'western_europe',
  Portugal: 'western_europe',
  Italy: 'western_europe',
  Switzerland: 'western_europe',
  Austria: 'western_europe',
  Belgium: 'western_europe',
  Netherlands: 'western_europe',
  Luxembourg: 'western_europe',
  Denmark: 'nordics',
  Sweden: 'nordics',
  Norway: 'nordics',
  Finland: 'nordics',
  Iceland: 'nordics',
  Poland: 'eastern_europe',
  'Czech Republic': 'eastern_europe',
  Hungary: 'eastern_europe',
  Romania: 'eastern_europe',
  Greece: 'eastern_europe',
  Estonia: 'eastern_europe',
  Latvia: 'eastern_europe',
  Lithuania: 'eastern_europe',
  Australia: 'anz',
  'New Zealand': 'anz',
  Singapore: 'southeast_asia',
  Malaysia: 'southeast_asia',
  Indonesia: 'southeast_asia',
  Philippines: 'southeast_asia',
  Thailand: 'southeast_asia',
  Vietnam: 'southeast_asia',
  'Hong Kong': 'east_asia',
  Taiwan: 'east_asia',
  Japan: 'east_asia',
  'South Korea': 'east_asia',
  China: 'east_asia',
  India: 'south_asia',
  Pakistan: 'south_asia',
  Bangladesh: 'south_asia',
  'Sri Lanka': 'south_asia',
  'United Arab Emirates': 'middle_east',
  'Saudi Arabia': 'middle_east',
  Qatar: 'middle_east',
  Israel: 'middle_east',
  Turkey: 'middle_east',
  Egypt: 'middle_east',
  Nigeria: 'africa',
  Kenya: 'africa',
  Ghana: 'africa',
  'South Africa': 'africa',
  Morocco: 'africa',
  Brazil: 'latin_america',
  Mexico: 'latin_america',
  Argentina: 'latin_america',
  Chile: 'latin_america',
  Colombia: 'latin_america',
  Peru: 'latin_america',
  'Costa Rica': 'latin_america',
  Uruguay: 'latin_america',
};

// Real, well-known employers per region — additive to DATA_COMPANIES, never
// a replacement for it (North America already IS the base list, so gets no
// separate entries here). Deliberately kept to major, easily-recognizable
// names only — this is flavor text for interview question framing (see
// LiveInterviewSession.tsx), not a claim of any hiring relationship, so
// nothing obscure or unverifiable.
export const REGION_COMPANIES: Partial<Record<CompanyRegion, string[]>> = {
  uk_ireland: [
    'HSBC', 'Barclays', 'BP', 'Unilever', 'Vodafone', 'Tesco',
    'GlaxoSmithKline', 'AstraZeneca', 'Rolls-Royce', 'Revolut', 'Sky',
  ],
  western_europe: [
    'SAP', 'Siemens', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Nestlé',
    'Roche', 'Novartis', 'LVMH', "L'Oréal", 'TotalEnergies', 'ING',
    'Philips', 'ASML', 'Adyen',
  ],
  nordics: [
    'Spotify', 'Ericsson', 'Volvo', 'IKEA', 'Novo Nordisk', 'Maersk',
    'Nokia', 'H&M', 'Equinor', 'Klarna',
  ],
  eastern_europe: [
    'CD Projekt', 'Škoda Auto', 'Wise', 'Bolt', 'InPost', 'Allegro',
    'MOL Group',
  ],
  anz: [
    'Atlassian', 'Canva', 'Commonwealth Bank', 'BHP', 'Telstra',
    'Woolworths', 'Xero', 'Qantas',
  ],
  southeast_asia: [
    'Grab', 'Sea Limited', 'DBS Bank', 'Singtel', 'Gojek', 'Tokopedia',
    'TSMC', 'PLDT',
  ],
  east_asia: [
    'Sony', 'Toyota', 'SoftBank', 'Rakuten', 'Samsung', 'LG', 'Hyundai',
    'Naver', 'Alibaba', 'Tencent', 'ByteDance', 'Huawei',
  ],
  south_asia: [
    'Tata Consultancy Services', 'Infosys', 'Wipro', 'Reliance Industries',
    'HDFC Bank', 'Flipkart', 'Zomato',
  ],
  middle_east: [
    'Emirates', 'Saudi Aramco', 'Qatar Airways', 'Wix', 'Check Point',
    'Careem', 'noon', 'Turkish Airlines',
  ],
  africa: [
    'Flutterwave', 'Paystack', 'MTN Group', 'Dangote Group', 'Safaricom',
    'Naspers', 'Standard Bank', 'Jumia',
  ],
  latin_america: [
    'Nubank', 'Mercado Libre', 'Itaú Unibanco', 'Rappi', 'América Móvil',
    'Grupo Bimbo', 'iFood',
  ],
};

/**
 * Region-aware company list for the interview setup company picker — the
 * user's own regional employers (deduped, in REGION_COMPANIES order) first,
 * then the rest of DATA_COMPANIES. Takes the user's full preferredCountries
 * list (not just the first entry) since a user can select more than one at
 * signup/in JobPreferences.tsx, and surfaces every matching region's
 * companies, not just the first country's.
 */
export function companiesForCountries(preferredCountries: string[] | undefined): string[] {
  const regional: string[] = [];
  const seen = new Set<string>();
  (preferredCountries ?? []).forEach(country => {
    const region = REGION_BY_COUNTRY[country];
    const companies = region ? REGION_COMPANIES[region] : undefined;
    (companies ?? []).forEach(name => {
      if (!seen.has(name)) {
        seen.add(name);
        regional.push(name);
      }
    });
  });
  const rest = DATA_COMPANIES.filter(name => !seen.has(name));
  return [...regional, ...rest];
}

// ---- AI Interview Coach additions (gamification / badges) ----
// Unlock conditions are computed client-side from whatever's cheaply
// derivable out of existing mock data (practice history, streak, ATS score,
// etc.) — see src/home/HomeSrc.tsx. TODO: once a backend exists, badge
// unlocks should be computed/awarded server-side so they can't be spoofed by
// tampering with local AsyncStorage.
export const DATA_BADGES: BadgeDefinitionProps[] = [
  {
    id: 'first_interview',
    title: 'First Interview',
    description: 'Complete your first mock interview.',
    icon: 'interview',
  },
  {
    id: 'five_sessions',
    title: 'Getting Reps In',
    description: 'Complete 5 mock interview sessions.',
    icon: 'stats',
  },
  {
    id: 'ten_sessions',
    title: 'Interview Regular',
    description: 'Complete 10 mock interview sessions.',
    icon: 'premiumAcc',
  },
  {
    id: 'three_day_streak',
    title: '3-Day Streak',
    description: 'Practice 3 days in a row.',
    icon: 'calendar',
  },
  {
    id: 'five_day_streak',
    title: '5-Day Streak',
    description: 'Practice 5 days in a row.',
    icon: 'calendarActive',
  },
  {
    id: 'perfect_score',
    title: 'Perfect Score',
    description: 'Score 90% or higher on a mock interview.',
    icon: 'rateFull',
  },
  {
    id: 'resume_uploaded',
    title: 'Resume Ready',
    description: 'Import a resume in Resume Builder.',
    icon: 'myPost',
  },
  {
    id: 'ats_optimized',
    title: 'ATS Optimized',
    description: 'Reach an ATS score of 80 or higher.',
    icon: 'edit_full',
  },
  {
    id: 'coding_complete',
    title: 'Coding Challenge Complete',
    description: 'Finish a Coding interview session.',
    icon: 'edit',
  },
  {
    id: 'networker',
    title: 'Networker',
    description: 'Add 3 contacts in the Networking Assistant.',
    icon: 'share',
  },
];

// ---- AI Interview Coach additions (learning courses) ----
// TODO: mock course catalog + local progress only — a real backend would
// serve course content/lessons and track progress server-side.
export interface CourseProps {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  category: 'Behavioral' | 'Technical' | 'Salary Negotiation' | 'Resume' | 'System Design' | 'Networking' | 'Onboarding';
  totalModules: number;
  completedModules: number;
}

// Product request item (new-job/first-job coaching track): "coach users
// through starting a new/first job - workplace norms, relating to
// coworkers, general onboarding-to-the-job guidance." Exported as its own
// constant (not just inlined into DATA_COURSES below) so
// src/messages/Chat.tsx's SUGGESTED_ACTION: new_job_course handler (see
// app/api/coach.py's ACTION_REFERRAL_INSTRUCTION) can jump straight into
// this exact course — same title, so it's the same course_id
// (learningService.courseIdFor) and shares progress whether the learner
// starts it from the coach chip or from this catalog card.
export const NEW_JOB_COURSE_TITLE = 'Starting Your New Job';
export const NEW_JOB_COURSE_MODULES = 5;

export const DATA_COURSES: CourseProps[] = [
  {
    id: 'course_star',
    title: 'Mastering the STAR Method',
    description: 'Structure compelling behavioral answers using Situation, Task, Action, Result.',
    durationMin: 35,
    category: 'Behavioral',
    totalModules: 5,
    completedModules: 2,
  },
  {
    id: 'course_system_design',
    title: 'System Design Fundamentals',
    description: 'Learn the building blocks interviewers expect in a system design round.',
    durationMin: 60,
    category: 'System Design',
    totalModules: 6,
    completedModules: 0,
  },
  {
    id: 'course_salary_negotiation',
    title: 'Negotiating Your Offer',
    description: 'Practical tactics for negotiating salary, equity, and other perks.',
    durationMin: 25,
    category: 'Salary Negotiation',
    totalModules: 4,
    completedModules: 4,
  },
  {
    id: 'course_resume',
    title: 'Resume Writing That Gets Interviews',
    description: 'Turn vague bullet points into quantified, ATS-friendly achievements.',
    durationMin: 30,
    category: 'Resume',
    totalModules: 5,
    completedModules: 1,
  },
  {
    id: 'course_algo_patterns',
    title: 'Common Coding Interview Patterns',
    description: 'Two pointers, sliding window, and other patterns that show up again and again.',
    durationMin: 50,
    category: 'Technical',
    totalModules: 6,
    completedModules: 0,
  },
  {
    id: 'course_networking',
    title: 'Networking Without the Cringe',
    description: 'How to reach out, follow up, and build a genuine professional network.',
    durationMin: 20,
    category: 'Networking',
    totalModules: 3,
    completedModules: 0,
  },
  {
    id: 'course_executive_presence',
    title: 'Executive Presence in Interviews',
    description: 'Communicate with clarity and confidence in senior-level interviews.',
    durationMin: 40,
    category: 'Behavioral',
    totalModules: 5,
    completedModules: 0,
  },
  {
    id: 'course_new_job_onboarding',
    title: NEW_JOB_COURSE_TITLE,
    description: 'Workplace norms, relating to coworkers, and thriving in your first 90 days on the job.',
    durationMin: 35,
    category: 'Onboarding',
    totalModules: NEW_JOB_COURSE_MODULES,
    completedModules: 0,
  },
];

// ---- AI Interview Coach additions (networking assistant) ----
export const DATA_NETWORKING_CONTACTS: NetworkingContactProps[] = [
  {
    id: 'contact_1',
    name: 'Priya Natarajan',
    company: 'Nimbus Analytics',
    role: 'Senior Product Manager',
    lastContactedDate: 1719340800000,
    note: 'Met at a PM meetup — offered to do a referral once I apply.',
  },
  {
    id: 'contact_2',
    name: 'Marcus Feld',
    company: 'Solace Robotics',
    role: 'Engineering Manager',
    lastContactedDate: 1717440000000,
    note: 'LinkedIn intro from a former coworker. Follow up after final round.',
  },
  {
    id: 'contact_3',
    name: 'Dana Whitfield',
    company: 'Lark & Co Consulting',
    role: 'Recruiter',
    lastContactedDate: 1716230400000,
    note: 'Sent offer details — need to send thank-you note.',
  },
];
