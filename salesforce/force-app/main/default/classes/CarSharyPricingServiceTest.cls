@IsTest
public class CarSharyPricingServiceTest {
  @IsTest
  static void updatesAcceptedCountAndFare() {
    AppUser__c driver = new AppUser__c(
      Name = 'Driver A',
      Email__c = 'driver.pricing@test.local',
      Role__c = 'Driver',
      Verified__c = true,
      ExternalUserId__c = 'DRV-1'
    );
    insert driver;

    AppUser__c rider1 = new AppUser__c(
      Name = 'Rider One',
      Email__c = 'rider1.pricing@test.local',
      Role__c = 'Rider',
      Verified__c = true,
      ExternalUserId__c = 'RID-1'
    );
    insert rider1;

    AppUser__c rider2 = new AppUser__c(
      Name = 'Rider Two',
      Email__c = 'rider2.pricing@test.local',
      Role__c = 'Rider',
      Verified__c = true,
      ExternalUserId__c = 'RID-2'
    );
    insert rider2;

    Ride__c ride = new Ride__c(
      Name = 'Pricing Ride',
      ExternalRideId__c = 'RIDE-1',
      Driver__c = driver.Id,
      StartText__c = 'A',
      EndText__c = 'B',
      DistanceKm__c = 10,
      BaseFare__c = 20,
      RatePerKm__c = 6,
      SurgeMultiplier__c = 1
    );
    insert ride;

    RideRequest__c req1 = new RideRequest__c(
      Name = 'Req1',
      ExternalRequestId__c = 'REQ-1',
      Ride__c = ride.Id,
      Rider__c = rider1.Id,
      Status__c = 'Requested'
    );
    insert req1;

    PromoCode__c promo = new PromoCode__c(
      Name = 'Promo 10%',
      Code__c = 'TEST10',
      Value__c = 10,
      DiscountType__c = 'Percent',
      EligibleRole__c = 'Rider',
      Active__c = true,
      MaxUses__c = 1,
      UsedCount__c = 0,
      Rider__c = rider1.Id,
      Ride__c = ride.Id,
      ExpiresAt__c = System.now().addDays(3)
    );
    insert promo;

    req1.Status__c = 'Accepted';
    req1.PromoCode__c = promo.Id;
    update req1;

    Ride__c r1 = [SELECT AcceptedCount__c FROM Ride__c WHERE Id = :ride.Id];
    System.assertEquals(1, Integer.valueOf(r1.AcceptedCount__c), 'AcceptedCount should be 1');

    RideRequest__c rr1 = [SELECT Fare__c FROM RideRequest__c WHERE Id = :req1.Id];
    rr1 = [SELECT Fare__c, DiscountAmount__c, PromoUsed__c FROM RideRequest__c WHERE Id = :req1.Id];
    System.assertEquals(40, Integer.valueOf(rr1.Fare__c), 'Fare should be 80/2 = 40');
    System.assertEquals(4, Integer.valueOf(rr1.DiscountAmount__c), 'Discount should be 10% of 40 = 4');
    System.assertEquals(true, rr1.PromoUsed__c, 'PromoUsed should be set');

    PromoCode__c promoAfter = [SELECT UsedCount__c, Active__c FROM PromoCode__c WHERE Id = :promo.Id];
    System.assertEquals(1, Integer.valueOf(promoAfter.UsedCount__c), 'Promo used count should increment');
    System.assertEquals(false, promoAfter.Active__c, 'Promo should deactivate at max uses');

    RideRequest__c req2 = new RideRequest__c(
      Name = 'Req2',
      ExternalRequestId__c = 'REQ-2',
      Ride__c = ride.Id,
      Rider__c = rider2.Id,
      Status__c = 'Accepted'
    );
    insert req2;

    Ride__c r2 = [SELECT AcceptedCount__c FROM Ride__c WHERE Id = :ride.Id];
    System.assertEquals(2, Integer.valueOf(r2.AcceptedCount__c), 'AcceptedCount should be 2');

    // Suggested = 20 + 10*6 = 80. Per-rider with 2 accepted => 80/3 => 26.6 => rounds to 27.
    List<RideRequest__c> accepted = [
      SELECT Fare__c
      FROM RideRequest__c
      WHERE Ride__c = :ride.Id AND Status__c = 'Accepted'
    ];
    System.assertEquals(2, accepted.size(), 'Two accepted requests expected');
    for (RideRequest__c rr : accepted) {
      System.assertEquals(27, Integer.valueOf(rr.Fare__c), 'Fare should be updated for all accepted riders');
    }
  }
}
