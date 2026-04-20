public with sharing class CarSharyIncidentService {
  private static Boolean running = false;

  public static void handleNewIncidents(List<Incident__c> incidents) {
    if (running) return;
    if (incidents == null || incidents.isEmpty()) return;
    running = true;
    try {
      List<Incident__c> toUpdate = new List<Incident__c>();
      for (Incident__c i : incidents) {
        if (i.Type__c == 'SOS') {
          Incident__c upd = new Incident__c(
            Id = i.Id,
            Flagged__c = true,
            Status__c = 'Escalated'
          );
          toUpdate.add(upd);
        }
      }
      if (!toUpdate.isEmpty()) update toUpdate;

      // Create a Task for admins to make the alert visible in Salesforce UI
      List<User> admins = [
        SELECT Id, Email
        FROM User
        WHERE IsActive = true AND Profile.Name = 'System Administrator'
        ORDER BY LastLoginDate DESC NULLS LAST
        LIMIT 1
      ];
      Id ownerId = admins.isEmpty() ? UserInfo.getUserId() : admins[0].Id;

      List<Task> tasks = new List<Task>();
      for (Incident__c i : incidents) {
        if (i.Type__c != 'SOS') continue;
        Task t = new Task();
        t.OwnerId = ownerId;
        t.Subject = 'SOS Alert (CarShary)';
        t.Priority = 'High';
        t.Status = 'Not Started';
        t.Description =
          'SOS raised in CarShary.' +
          (i.Ride__c != null ? (' Ride: ' + i.Ride__c) : '') +
          (i.Reporter__c != null ? (' Reporter: ' + i.Reporter__c) : '') +
          (String.isBlank(i.Reason__c) ? '' : (' Reason: ' + i.Reason__c));
        tasks.add(t);
      }
      if (!tasks.isEmpty()) insert tasks;
    } finally {
      running = false;
    }
  }
}

