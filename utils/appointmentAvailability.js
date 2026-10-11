
const ACTIVE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
];

const getMaximumConcurrentCount = (
  existingAppointments,
  candidateStart,
  candidateEnd,
) => {
  const start = new Date(candidateStart).getTime();
  const end = new Date(candidateEnd).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end
  ) {
    throw new Error("Invalid candidate appointment interval.");
  }

  if (!Array.isArray(existingAppointments)) {
    throw new TypeError("Existing appointments must be an array.");
  }

  const events = [
    { time: start, change: 1 },
    { time: end, change: -1 },
  ];

  for (const appointment of existingAppointments) {
    const existingStart = new Date(
      appointment.scheduledAt,
    ).getTime();

    const existingEnd = new Date(
      appointment.scheduledEndAt,
    ).getTime();

    if (
      !Number.isFinite(existingStart) ||
      !Number.isFinite(existingEnd) ||
      existingStart >= existingEnd
    ) {
      throw new Error(
        "An existing appointment has an invalid scheduled interval.",
      );
    }

    // Ignore appointments that do not overlap the candidate.
    if (existingStart >= end || existingEnd <= start) {
      continue;
    }

    // Clip existing intervals to the candidate interval.
    events.push(
      {
        time: Math.max(existingStart, start),
        change: 1,
      },
      {
        time: Math.min(existingEnd, end),
        change: -1,
      },
    );
  }

  // Process departures before arrivals at the same instant.
  events.sort(
    (a, b) => a.time - b.time || a.change - b.change,
  );

  let concurrent = 0;
  let maximum = 0;

  for (const event of events) {
    concurrent += event.change;
    maximum = Math.max(maximum, concurrent);
  }

  return maximum;
};

export {
  ACTIVE_STATUSES,
  getMaximumConcurrentCount,
};
