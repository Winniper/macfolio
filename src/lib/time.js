// Milliseconds until the wall clock next reaches :00 seconds.
export const msUntilNextMinute = (date) =>
    60000 - (date.getSeconds() * 1000 + date.getMilliseconds());
