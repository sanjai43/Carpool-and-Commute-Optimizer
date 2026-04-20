@IsTest
public class CarSharyRideReminderJobTest {
  @IsTest
  static void createsReminderMessage() {
    AppUser__c driver = new AppUser__c(
      Name = 'Driver Rem',
      Email__c = 'driver.rem@test.local',
      Role__c = 'Driver',
      Verified__c = true,
      ExternalUserId__c = 'DRV-REM'
    );
    insert driver;

    Ride__c ride = new Ride__c(
      Name = 'Reminder Ride',
      ExternalRideId__c = 'RIDE-REM',
      Driver__c = driver.Id,
      StartText__c = 'A',
      EndText__c = 'B',
      DistanceKm__c = 5,
      DepartureTime__c = System.now().addMinutes(10),
      Status__c = 'Open'
    );
    insert ride;

    Test.startTest();
    CarSharyRideReminderJob.runOnce();
    Test.stopTest();

    List<Message__c> msgs = [
      SELECT Id, Ride__c, Text__c
      FROM Message__c
      WHERE Ride__c = :ride.Id
    ];
    System.assert(msgs.size() >= 1, 'Expected at least one reminder message');
  }
}

