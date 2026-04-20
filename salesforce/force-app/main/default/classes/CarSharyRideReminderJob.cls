public with sharing class CarSharyRideReminderJob implements Schedulable {
  public void execute(SchedulableContext sc) {
    CarSharyRideReminderJob.runOnce();
  }

  public static void runOnce() {
    // Window: next 20 minutes
    DateTime now = System.now();
    DateTime toTime = now.addMinutes(20);

    List<Ride__c> rides = [
      SELECT Id, DepartureTime__c, Status__c, StartText__c, EndText__c
      FROM Ride__c
      WHERE Status__c = 'Open'
        AND DepartureTime__c != null
        AND DepartureTime__c >= :now
        AND DepartureTime__c <= :toTime
      LIMIT 200
    ];
    if (rides.isEmpty()) return;

    // Ensure bot author exists
    AppUser__c bot;
    List<AppUser__c> bots = [
      SELECT Id, Name
      FROM AppUser__c
      WHERE ExternalUserId__c = 'BOT'
      LIMIT 1
    ];
    if (!bots.isEmpty()) {
      bot = bots[0];
    } else {
      bot = new AppUser__c(
        Name = 'CarShary Bot',
        Email__c = 'bot@carshary.local',
        Role__c = 'Admin',
        Verified__c = true,
        ExternalUserId__c = 'BOT'
      );
      insert bot;
    }

    // Build deterministic external ids to avoid duplicates across schedules
    Map<String, Id> externalToRide = new Map<String, Id>();
    for (Ride__c r : rides) {
      String key = 'REM-' + String.valueOf(r.Id) + '-' + r.DepartureTime__c.formatGMT('yyyyMMddHHmm');
      if (key.length() > 80) key = key.substring(0, 80);
      externalToRide.put(key, r.Id);
    }

    Set<String> keys = externalToRide.keySet();
    Map<String, Message__c> existing = new Map<String, Message__c>();
    for (Message__c m : [
      SELECT Id, ExternalMessageId__c
      FROM Message__c
      WHERE ExternalMessageId__c IN :keys
    ]) {
      existing.put(m.ExternalMessageId__c, m);
    }

    List<Message__c> toInsert = new List<Message__c>();
    for (Ride__c r : rides) {
      String key = 'REM-' + String.valueOf(r.Id) + '-' + r.DepartureTime__c.formatGMT('yyyyMMddHHmm');
      if (key.length() > 80) key = key.substring(0, 80);
      if (existing.containsKey(key)) continue;

      Message__c msg = new Message__c();
      msg.Name = 'Reminder ' + now.format('yyyy-MM-dd HH:mm');
      msg.ExternalMessageId__c = key;
      msg.Author__c = bot.Id;
      msg.Ride__c = r.Id;
      msg.Text__c =
        'Reminder: ride departs at ' + r.DepartureTime__c.format() +
        ' (' + (r.StartText__c == null ? '' : r.StartText__c) +
        ' → ' + (r.EndText__c == null ? '' : r.EndText__c) + ').';
      toInsert.add(msg);
    }

    if (!toInsert.isEmpty()) insert toInsert;
  }
}

