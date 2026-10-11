// The calendar day every daily thing turns on: Cooee Word's word, Ready the
// Block's yard and the drill's twist. One Melbourne calendar day is one day,
// whatever the phone's own zone, so the day turns at local midnight and not at
// 10 am when the UTC day does. Time is always a parameter here.

import { MS_PER_DAY } from './constants';

const melbourneDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' });

/** Whole Melbourne calendar days since 1 January 1970. en-CA formats as
 *  YYYY-MM-DD, which parses back as that day's UTC midnight. */
export const melbourneDay = (now: number): number => Date.parse(melbourneDate.format(now)) / MS_PER_DAY;

/** How many days are left in the stretch of `period` days that `day` falls
 *  in, counting today: 1 on the last day of the stretch. Stretches start on
 *  `epoch`, and a day before it still lands in a whole stretch. */
export const daysLeftInPeriod = (day: number, period: number, epoch = 0): number =>
  period - ((((day - epoch) % period) + period) % period);
