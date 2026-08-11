import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

function parseValue(value?: string | null) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function getDayDiff(value?: string | null) {
  const parsed = parseValue(value);

  if (!parsed) {
    return null;
  }

  return dayjs().startOf("day").diff(parsed.startOf("day"), "day");
}

export function formatDateTime(value?: string | null) {
  const parsed = parseValue(value);
  return parsed ? parsed.format("MMM D, YYYY HH:mm") : "-";
}

export function formatDate(value?: string | null) {
  const parsed = parseValue(value);
  return parsed ? parsed.format("MMM D, YYYY") : "-";
}

export function formatRelative(value?: string | null) {
  const dayDiff = getDayDiff(value);

  if (dayDiff == null) {
    return "-";
  }

  if (dayDiff <= 0) {
    return "Today";
  }

  if (dayDiff === 1) {
    return "Yesterday";
  }

  if (dayDiff < 30) {
    return `${dayDiff} days ago`;
  }

  return formatDate(value);
}

export function bucketByTime(value?: string | null) {
  const dayDiff = getDayDiff(value);
  const parsed = parseValue(value);

  if (dayDiff == null || !parsed) {
    return "No messages";
  }

  if (dayDiff <= 0) {
    return "Today";
  }

  if (dayDiff < 7) {
    return "One week ago";
  }

  if (dayDiff < 30) {
    return "One month ago";
  }

  return parsed.format("MMM YYYY");
}
