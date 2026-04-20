public with sharing class CarSharySchedulerSetup {
  // Run once via Execute Anonymous to schedule reminders every 5 minutes:
  // CarSharySchedulerSetup.scheduleRideReminders();
  public static void scheduleRideReminders() {
    // Prevent duplicates
    for (CronTrigger ct : [
      SELECT Id, CronJobDetail.Name, State
      FROM CronTrigger
      WHERE CronJobDetail.Name = 'CarSharyRideReminderJob'
    ]) {
      try {
        System.abortJob(ct.Id);
      } catch (Exception e) {
        // ignore
      }
    }
    System.schedule('CarSharyRideReminderJob', '0 0/5 * * * ?', new CarSharyRideReminderJob());
  }
}

