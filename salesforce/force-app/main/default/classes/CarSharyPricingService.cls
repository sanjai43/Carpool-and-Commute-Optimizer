public with sharing class CarSharyPricingService {
  private static Boolean running = false;

  public static void handleRideRequestChange(Set<Id> rideIds) {
    if (running) return;
    if (rideIds == null || rideIds.isEmpty()) return;
    running = true;
    try {
      Map<Id, Integer> acceptedByRide = new Map<Id, Integer>();
      for (AggregateResult ar : [
        SELECT Ride__c rideId, COUNT(Id) cnt
        FROM RideRequest__c
        WHERE Ride__c IN :rideIds AND Status__c = 'Accepted'
        GROUP BY Ride__c
      ]) {
        acceptedByRide.put((Id) ar.get('rideId'), (Integer) ar.get('cnt'));
      }

      List<Ride__c> ridesToUpdate = new List<Ride__c>();
      for (Id rideId : rideIds) {
        Integer cnt = acceptedByRide.containsKey(rideId) ? acceptedByRide.get(rideId) : 0;
        ridesToUpdate.add(new Ride__c(Id = rideId, AcceptedCount__c = cnt));
      }
      if (!ridesToUpdate.isEmpty()) update ridesToUpdate;

      Map<Id, Ride__c> rides = new Map<Id, Ride__c>([
        SELECT Id, DistanceKm__c, BaseFare__c, RatePerKm__c, SurgeMultiplier__c, AcceptedCount__c
        FROM Ride__c
        WHERE Id IN :rideIds
      ]);

      Map<Id, Decimal> perRiderByRide = new Map<Id, Decimal>();
      for (Ride__c r : rides.values()) {
        Decimal baseFare = r.BaseFare__c == null ? 20 : r.BaseFare__c;
        Decimal ratePerKm = r.RatePerKm__c == null ? 6 : r.RatePerKm__c;
        Decimal distanceKm = r.DistanceKm__c == null ? 0 : r.DistanceKm__c;
        Decimal surge = r.SurgeMultiplier__c == null ? 1 : r.SurgeMultiplier__c;

        Decimal suggested = (baseFare + (distanceKm * ratePerKm)) * surge;
        suggested = suggested.setScale(0);

        Integer accepted = r.AcceptedCount__c == null ? 0 : Integer.valueOf(r.AcceptedCount__c);
        Decimal per = suggested;
        if (accepted >= 1) {
          per = (suggested / (accepted + 1)).setScale(0);
        }
        perRiderByRide.put(r.Id, per);
      }

      List<RideRequest__c> acceptedReqs = [
        SELECT Id, Ride__c, Rider__c, Fare__c, DiscountAmount__c, PromoCode__c, PromoUsed__c,
               PromoCode__r.Active__c, PromoCode__r.DiscountType__c, PromoCode__r.Value__c,
               PromoCode__r.EligibleRole__c, PromoCode__r.MaxUses__c, PromoCode__r.UsedCount__c,
               PromoCode__r.ExpiresAt__c, PromoCode__r.Rider__c
        FROM RideRequest__c
        WHERE Ride__c IN :rideIds AND Status__c = 'Accepted'
      ];

      DateTime now = System.now();
      List<RideRequest__c> reqsToUpdate = new List<RideRequest__c>();
      Map<Id, Integer> promoIncrements = new Map<Id, Integer>();
      for (RideRequest__c rr : acceptedReqs) {
        Decimal per = perRiderByRide.get(rr.Ride__c);
        if (per == null) continue;

        Boolean changed = false;
        if (rr.Fare__c != per) {
          rr.Fare__c = per;
          changed = true;
        }

        // Promo discount (optional)
        Decimal discount = 0;
        Boolean promoValid = false;
        if (rr.PromoCode__c != null && rr.PromoCode__r != null) {
          PromoCode__c p = rr.PromoCode__r;
          Boolean active = p.Active__c == true;
          Boolean notExpired = (p.ExpiresAt__c == null) || (p.ExpiresAt__c > now);
          Integer maxUses = p.MaxUses__c == null ? 0 : Integer.valueOf(p.MaxUses__c);
          Integer used = p.UsedCount__c == null ? 0 : Integer.valueOf(p.UsedCount__c);
          Boolean hasUses = (maxUses == 0) || (used < maxUses);
          Boolean roleOk = (p.EligibleRole__c == null) || (p.EligibleRole__c == 'Any') || (p.EligibleRole__c == 'Rider');
          Boolean riderOk = (p.Rider__c == null) || (rr.Rider__c != null && p.Rider__c == rr.Rider__c);

          promoValid = active && notExpired && hasUses && roleOk && riderOk;
          if (promoValid) {
            if (p.DiscountType__c == 'Percent') {
              Decimal pct = p.Value__c == null ? 0 : p.Value__c;
              discount = (per * pct / 100).setScale(0);
            } else {
              discount = p.Value__c == null ? 0 : p.Value__c;
            }
            if (discount > per) discount = per;
          }
        }

        if (rr.DiscountAmount__c != discount) {
          rr.DiscountAmount__c = discount;
          changed = true;
        }

        // Increment promo usage once per request
        if (promoValid && rr.PromoCode__c != null && rr.PromoUsed__c != true) {
          rr.PromoUsed__c = true;
          changed = true;
          promoIncrements.put(rr.PromoCode__c, (promoIncrements.containsKey(rr.PromoCode__c) ? promoIncrements.get(rr.PromoCode__c) : 0) + 1);
        }

        if (changed) reqsToUpdate.add(rr);
      }
      if (!reqsToUpdate.isEmpty()) update reqsToUpdate;

      if (!promoIncrements.isEmpty()) {
        List<PromoCode__c> promos = [
          SELECT Id, Active__c, MaxUses__c, UsedCount__c
          FROM PromoCode__c
          WHERE Id IN :promoIncrements.keySet()
        ];
        List<PromoCode__c> promosToUpdate = new List<PromoCode__c>();
        for (PromoCode__c p : promos) {
          Integer inc = promoIncrements.get(p.Id);
          Integer used = p.UsedCount__c == null ? 0 : Integer.valueOf(p.UsedCount__c);
          Integer maxUses = p.MaxUses__c == null ? 0 : Integer.valueOf(p.MaxUses__c);
          used += inc;
          p.UsedCount__c = used;
          if (maxUses != 0 && used >= maxUses) p.Active__c = false;
          promosToUpdate.add(p);
        }
        if (!promosToUpdate.isEmpty()) update promosToUpdate;
      }
    } finally {
      running = false;
    }
  }
}
