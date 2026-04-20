@RestResource(urlMapping='/carshary/v1/*')
global with sharing class CarSharyApi {
  private static String subPath() {
    String uri = RestContext.request != null ? RestContext.request.requestURI : '';
    Integer idx = uri != null ? uri.toLowerCase().indexOf('/carshary/v1/') : -1;
    if (idx < 0) return '';
    String out = uri.substring(idx + '/carshary/v1/'.length());
    if (out != null && out.startsWith('/')) out = out.substring(1);
    return out != null ? out : '';
  }

  private static void json(Integer statusCode, Object body) {
    RestContext.response.statusCode = statusCode;
    RestContext.response.addHeader('Content-Type', 'application/json');
    RestContext.response.responseBody = Blob.valueOf(JSON.serialize(body));
  }

  private static String requireParam(String name) {
    String v = RestContext.request != null ? RestContext.request.params.get(name) : null;
    if (String.isBlank(v)) {
      json(400, new Map<String, Object>{ 'ok' => false, 'message' => 'Missing param: ' + name });
      return null;
    }
    return v;
  }

  @HttpGet
  global static void doGet() {
    String p = subPath().toLowerCase();

    if (p == 'eco') {
      handleEco();
      return;
    }
    if (p == 'promos') {
      handlePromos();
      return;
    }
    if (p == 'earnings') {
      handleEarnings();
      return;
    }

    json(404, new Map<String, Object>{ 'ok' => false, 'message' => 'Unknown endpoint' });
  }

  private static void handleEco() {
    String userId = requireParam('userId');
    if (userId == null) return;

    List<Ride__c> ridesAsDriver = [
      SELECT Id, DistanceKm__c, CO2SavedKg__c, VehicleType__c
      FROM Ride__c
      WHERE Driver__c = :userId
      ORDER BY CreatedDate DESC
      LIMIT 500
    ];

    List<RideRequest__c> req = [
      SELECT Ride__c
      FROM RideRequest__c
      WHERE Rider__c = :userId AND Status__c = 'Accepted'
      LIMIT 2000
    ];
    Set<Id> passengerRideIds = new Set<Id>();
    for (RideRequest__c r : req) if (r.Ride__c != null) passengerRideIds.add(r.Ride__c);

    List<Ride__c> ridesAsPassenger = passengerRideIds.isEmpty()
      ? new List<Ride__c>()
      : [
          SELECT Id, DistanceKm__c, CO2SavedKg__c, VehicleType__c
          FROM Ride__c
          WHERE Id IN :passengerRideIds
          ORDER BY CreatedDate DESC
          LIMIT 500
        ];

    Decimal totalCO2 = 0;
    Decimal totalDistance = 0;
    Integer totalRides = 0;
    Map<String, Decimal> byVehicle = new Map<String, Decimal>();

    for (Ride__c r : ridesAsDriver) {
      Decimal co2 = r.CO2SavedKg__c != null ? r.CO2SavedKg__c : 0;
      Decimal km = r.DistanceKm__c != null ? r.DistanceKm__c : 0;
      totalCO2 += co2;
      totalDistance += km;
      totalRides += 1;
      String key = String.isBlank(r.VehicleType__c) ? 'PetrolCar' : r.VehicleType__c;
      byVehicle.put(key, (byVehicle.containsKey(key) ? byVehicle.get(key) : 0) + co2);
    }

    for (Ride__c r : ridesAsPassenger) {
      Decimal co2 = r.CO2SavedKg__c != null ? r.CO2SavedKg__c : 0;
      Decimal km = r.DistanceKm__c != null ? r.DistanceKm__c : 0;
      totalCO2 += co2;
      totalDistance += km;
      totalRides += 1;
      String key = String.isBlank(r.VehicleType__c) ? 'PetrolCar' : r.VehicleType__c;
      byVehicle.put(key, (byVehicle.containsKey(key) ? byVehicle.get(key) : 0) + co2);
    }

    Integer ecoScore = (Integer)Math.round((Double)(totalCO2 * 2));

    json(200, new Map<String, Object>{
      'totalCO2' => String.valueOf(totalCO2.setScale(2)),
      'totalDistance' => String.valueOf(totalDistance.setScale(1)),
      'totalRides' => totalRides,
      'ecoScore' => ecoScore,
      'byVehicle' => byVehicle
    });
  }

  private static void handlePromos() {
    String userId = requireParam('userId');
    if (userId == null) return;

    List<PromoCode__c> promos = [
      SELECT Id, Name, Code__c, Value__c, DiscountType__c, EligibleRole__c, Active__c, MaxUses__c, UsedCount__c, ExpiresAt__c, Ride__c, Rider__c, CreatedDate
      FROM PromoCode__c
      WHERE Rider__c = :userId
      ORDER BY CreatedDate DESC
      LIMIT 200
    ];

    List<Map<String, Object>> out = new List<Map<String, Object>>();
    for (PromoCode__c p : promos) {
      out.add(new Map<String, Object>{
        'id' => p.Id,
        'name' => p.Name,
        'code' => p.Code__c,
        'value' => p.Value__c,
        'discountType' => p.DiscountType__c,
        'eligibleRole' => p.EligibleRole__c,
        'active' => p.Active__c,
        'maxUses' => p.MaxUses__c,
        'usedCount' => p.UsedCount__c,
        'expiresAt' => p.ExpiresAt__c,
        'rideId' => p.Ride__c,
        'riderId' => p.Rider__c,
        'createdAt' => p.CreatedDate
      });
    }

    json(200, new Map<String, Object>{ 'promos' => out });
  }

  private static void handleEarnings() {
    String userId = requireParam('userId');
    if (userId == null) return;

    List<AggregateResult> rows = [
      SELECT Ride__c rideId, SUM(FinalFare__c) total, COUNT(Id) riders
      FROM RideRequest__c
      WHERE Status__c = 'Accepted' AND Ride__r.Status__c = 'Completed' AND Ride__r.Driver__c = :userId
      GROUP BY Ride__c
      LIMIT 200
    ];

    Decimal total = 0;
    List<Map<String, Object>> rides = new List<Map<String, Object>>();
    for (AggregateResult ar : rows) {
      Decimal t = (Decimal)ar.get('total');
      Decimal c = (Decimal)ar.get('riders');
      total += (t != null ? t : 0);
      rides.add(new Map<String, Object>{
        'rideId' => (Id)ar.get('rideId'),
        'total' => t,
        'riders' => c
      });
    }

    json(200, new Map<String, Object>{
      'total' => total,
      'rides' => rides
    });
  }
}

