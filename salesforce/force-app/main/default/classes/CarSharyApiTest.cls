@IsTest
private class CarSharyApiTest {
  private static void callGet(String endpoint, Map<String, String> params) {
    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();
    req.httpMethod = 'GET';
    req.requestURI = '/services/apexrest/carshary/v1/' + endpoint;
    if (params != null) {
      for (String k : params.keySet()) {
        req.addParameter(k, params.get(k));
      }
    }
    RestContext.request = req;
    RestContext.response = res;
    CarSharyApi.doGet();
  }

  @IsTest
  static void eco_promos_earnings() {
    AppUser__c driver = new AppUser__c(
      Name = 'Driver',
      ExternalUserId__c = 'D1',
      Email__c = 'd1@example.com',
      PasswordHash__c = 'x',
      Role__c = 'Driver',
      Verified__c = true
    );
    insert driver;

    AppUser__c rider = new AppUser__c(
      Name = 'Rider',
      ExternalUserId__c = 'R1',
      Email__c = 'r1@example.com',
      PasswordHash__c = 'x',
      Role__c = 'Rider',
      Verified__c = false
    );
    insert rider;

    Ride__c ride = new Ride__c(
      Name = 'A → B',
      ExternalRideId__c = 'DEMO-1',
      Driver__c = driver.Id,
      StartText__c = 'A',
      EndText__c = 'B',
      StartLat__c = 10,
      StartLng__c = 10,
      EndLat__c = 11,
      EndLng__c = 11,
      DepartureTime__c = System.now().addHours(1),
      VehicleType__c = 'PetrolCar',
      Capacity__c = 3,
      Status__c = 'Completed',
      DistanceKm__c = 10,
      CO2SavedKg__c = 2
    );
    insert ride;

    RideRequest__c rr = new RideRequest__c(
      Name = 'Req',
      ExternalRequestId__c = 'REQ-1',
      Ride__c = ride.Id,
      Rider__c = rider.Id,
      Status__c = 'Accepted',
      Fare__c = 100,
      DiscountAmount__c = 0
    );
    insert rr;

    PromoCode__c promo = new PromoCode__c(
      Name = 'P1',
      Code__c = 'P1',
      Rider__c = rider.Id,
      Value__c = 10,
      DiscountType__c = 'Percent',
      EligibleRole__c = 'Rider',
      Active__c = true,
      UsedCount__c = 0
    );
    insert promo;

    Test.startTest();
    callGet('eco', new Map<String, String>{ 'userId' => rider.Id });
    System.assertEquals(200, RestContext.response.statusCode);
    System.assert(RestContext.response.responseBody.toString().contains('totalRides'));

    callGet('promos', new Map<String, String>{ 'userId' => rider.Id });
    System.assertEquals(200, RestContext.response.statusCode);
    System.assert(RestContext.response.responseBody.toString().contains('P1'));

    callGet('earnings', new Map<String, String>{ 'userId' => driver.Id });
    System.assertEquals(200, RestContext.response.statusCode);
    System.assert(RestContext.response.responseBody.toString().contains('total'));
    Test.stopTest();
  }
}
