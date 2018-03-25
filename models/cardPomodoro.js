CardPomodoro = new Mongo.Collection('card_pomodoro');

CardPomodoro.attachSchema(new SimpleSchema({
  cardId: {
    type: String,
  },
  userId: {
    type: String,
    autoValue() {
      if (this.isInsert && !this.isSet) {
        return this.userId;
      }
    },
  },
  count: {
    type: SimpleSchema.Integer,
  },
}));

CardPomodoro.allow({
  insert(userId, doc) {
    return allowIsBoardMemberByCard(userId, Cards.findOne(doc.cardId));
  },

  update(userId, doc) {
    return doc.userId == userId;
  },

  remove(userId, doc) {
    return doc.userId == userId;
  },

  fetch: ['userId', 'cardId'],
});

CardPomodoro.mutations({
  incrementCount()
  {
    return {$set: {count: this.count + 1}};
  }
});

CardPomodoro.hookOptions.after.update = { fetchPrevious: false };

if (Meteor.isServer) {
  Meteor.startup(() => {
    CardPomodoro._collection._ensureIndex({ cardId: 1 });
  });
}
