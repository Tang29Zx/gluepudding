export function getDayKey(
  date: Date,
  timeZone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function getSecondsUntilNextDay(
  date: Date,
  timeZone: string,
): number {
  let low = date.getTime();
  let high = low + 30 * 60 * 60 * 1000;
  const currentDay = getDayKey(date, timeZone);

  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (getDayKey(new Date(middle), timeZone) === currentDay) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return Math.max(1, Math.ceil((high - date.getTime()) / 1000));
}
