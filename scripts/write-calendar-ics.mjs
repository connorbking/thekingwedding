import { writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "calendar");

const files = {
  "como.ics": `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//The King Wedding//Save the Date//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:como-2027-09-10@theking.wedding
DTSTAMP:20260923T173700Z
DTSTART;VALUE=DATE:20270910
DTEND;VALUE=DATE:20270913
SUMMARY:Alyssa & Connor · Lake Como
LOCATION:Exact Location TBD
DESCRIPTION:Save the Date for Alyssa and Connor at Lake Como\\, Italy on September 10-12\\, 2027. Formal invitation to follow.
URL:https://theking.wedding/como/save-the-date
END:VEVENT
END:VCALENDAR
`,
  "whippany.ics": `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//The King Wedding//Save the Date//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:jersey-2027-10-02@theking.wedding
DTSTAMP:20260923T173700Z
DTSTART;TZID=America/New_York:20271002T160000
DTEND;TZID=America/New_York:20271003T000000
SUMMARY:Alyssa & Connor · Whippany
LOCATION:19 Woodcrest Road\\, Whippany NJ 07981
DESCRIPTION:Save the Date for Alyssa and Connor in Whippany\\, New Jersey from 4:00 PM to midnight Eastern on October 2\\, 2027. Formal invitation to follow.
URL:https://theking.wedding/jersey/save-the-date
END:VEVENT
END:VCALENDAR
`,
  "shower.ics": `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//The King Wedding//Save the Date//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:shower-2027-06-05@theking.wedding
DTSTAMP:20260923T133000Z
DTSTART:20270605T180000Z
DTEND:20270605T210000Z
SUMMARY:Alyssa & Connor · Bridal Shower
LOCATION:Exact Location TBD
DESCRIPTION:Save the Date for Alyssa and Connor's bridal shower in New Jersey. Formal invitation to follow.
URL:https://theking.wedding/shower/save-the-date
END:VEVENT
END:VCALENDAR
`,
};

await mkdir(root, { recursive: true });
for (const [name, body] of Object.entries(files)) {
  await writeFile(join(root, name), body.replace(/\n/g, "\r\n"));
}
