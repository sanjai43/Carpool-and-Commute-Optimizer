trigger CarSharyRidePromoReward on Ride__c (after update) {
  Set<Id> completedRideIds = new Set<Id>();
  for (Ride__c r : Trigger.new) {
    Ride__c oldR = Trigger.oldMap.get(r.Id);
    if (oldR == null) continue;
    if (oldR.Status__c != 'Completed' && r.Status__c == 'Completed') {
      completedRideIds.add(r.Id);
    }
  }
  if (!completedRideIds.isEmpty()) {
    CarSharyPromoRewardService.onRidesCompleted(completedRideIds);
  }
}

