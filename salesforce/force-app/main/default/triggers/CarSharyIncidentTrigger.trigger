trigger CarSharyIncidentTrigger on Incident__c (after insert) {
  CarSharyIncidentService.handleNewIncidents(Trigger.new);
}

