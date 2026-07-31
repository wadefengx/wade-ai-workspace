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
  return parsed ? parsed.format("YYYY年M月D日 HH:mm") : "-";
}

export function formatDate(value?: string | null) {
  const parsed = parseValue(value);
  return parsed ? parsed.format("YYYY年M月D日") : "-";
}

export function formatRelative(value?: string | null) {
  const dayDiff = getDayDiff(value);

  if (dayDiff == null) {
    return "-";
  }

  if (dayDiff <= 0) {
    return "今天";
  }

  if (dayDiff === 1) {
    return "昨天";
  }

  if (dayDiff < 30) {
    return `${dayDiff}天前`;
  }

  return formatDate(value);
}

export function bucketByTime(value?: string | null) {
  const dayDiff = getDayDiff(value);
  const parsed = parseValue(value);

  if (dayDiff == null || !parsed) {
    return "暂无消息";
  }

  if (dayDiff <= 0) {
    return "今天";
  }

  if (dayDiff < 7) {
    return "一周前";
  }

  if (dayDiff < 30) {
    return "一月前";
  }

  return parsed.format("YYYY年M月");
}
