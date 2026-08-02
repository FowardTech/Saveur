import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import weekOfYear from "dayjs/plugin/weekOfYear";
import dayOfYear from "dayjs/plugin/dayOfYear";
import relativeTime from "dayjs/plugin/relativeTime";
// Needed for any "this is really just a calendar date, not a moment in
// time" field (e.g. an application's applied-on date) that the backend
// encodes as UTC midnight — see ApplicationItem.tsx/ApplicationDetails.tsx's
// dayjs.utc(...) usage. Formatting those with plain local dayjs(...) rolls
// back to the previous calendar day on any device in a timezone behind UTC.
import utc from "dayjs/plugin/utc";
import "dayjs/locale/en";
dayjs.extend(dayOfYear);
dayjs.extend(isToday);
dayjs.extend(weekOfYear);
dayjs.extend(relativeTime);
dayjs.extend(utc);

dayjs.locale("en");

export default dayjs;
