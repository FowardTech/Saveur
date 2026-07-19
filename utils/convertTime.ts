import dayjs from "./dayjs";

export const convertTime = (time: Date | number) => {
  let today = new Date();

  let x = dayjs(today).format("dd mm yy");
  let y = dayjs(time).format("dd mm yy");
  if (x === y) {
    return "Today";
  } else {
    return dayjs(time).format("ddd MMM DD");
  }
};
