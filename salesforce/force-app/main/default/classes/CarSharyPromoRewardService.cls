public with sharing class CarSharyPromoRewardService {
  private static Boolean running = false;

  public static void onRidesCompleted(Set<Id> rideIds) {
    if (running) return;
    if (rideIds == null || rideIds.isEmpty()) return;
    running = true;
    try {
      // Riders with accepted requests for completed rides
      List<RideRequest__c> accepted = [
        SELECT Id, Ride__c, Rider__c
        FROM RideRequest__c
        WHERE Ride__c IN :rideIds AND Status__c = 'Accepted' AND Rider__c != null
      ];
      if (accepted.isEmpty()) return;

      // Avoid duplicates: one promo per (ride,rider)
      Set<String> keys = new Set<String>();
      for (RideRequest__c rr : accepted) {
        keys.add(String.valueOf(rr.Ride__c) + ':' + String.valueOf(rr.Rider__c));
      }

      Map<String, PromoCode__c> existing = new Map<String, PromoCode__c>();
      for (PromoCode__c p : [
        SELECT Id, Ride__c, Rider__c
        FROM PromoCode__c
        WHERE Ride__c IN :rideIds AND Rider__c != null
      ]) {
        existing.put(String.valueOf(p.Ride__c) + ':' + String.valueOf(p.Rider__c), p);
      }

      List<PromoCode__c> toInsert = new List<PromoCode__c>();
      Integer i = 0;
      for (RideRequest__c rr : accepted) {
        String k = String.valueOf(rr.Ride__c) + ':' + String.valueOf(rr.Rider__c);
        if (existing.containsKey(k)) continue;

        // Demo reward: 10% off, expires in 7 days
        String code = 'CBE-' + String.valueOf(rr.Ride__c).right(5) + '-' + String.valueOf(rr.Rider__c).right(4) + '-' + String.valueOf(i);
        code = code.length() > 40 ? code.substring(0, 40) : code;

        PromoCode__c promo = new PromoCode__c();
        promo.Name = 'Reward ' + DateTime.now().format('yyyy-MM-dd HH:mm');
        promo.Code__c = code;
        promo.Value__c = 10;
        promo.DiscountType__c = 'Percent';
        promo.EligibleRole__c = 'Rider';
        promo.Active__c = true;
        promo.MaxUses__c = 1;
        promo.UsedCount__c = 0;
        promo.Ride__c = rr.Ride__c;
        promo.Rider__c = rr.Rider__c;
        promo.ExpiresAt__c = DateTime.now().addDays(7);
        toInsert.add(promo);
        i++;
      }

      if (!toInsert.isEmpty()) insert toInsert;
    } finally {
      running = false;
    }
  }
}

