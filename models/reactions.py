from db_init import db

reaction_user = db.Table(
    "reaction_user",
    db.Column("user_id", db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    db.Column("reaction_id", db.Integer, db.ForeignKey("reaction.id",  ondelete="CASCADE"), primary_key=True),
)

class Reaction(db.Model):
    __tablename__ = 'reaction'
    
    id = db.Column(db.Integer, primary_key=True) # Reaction ID
    target_type = db.Column(db.String(50), nullable=False)  # News, Messages, Chat
    target_id = db.Column(db.Integer, nullable=False) # Comment or Message ID
    emoji = db.Column(db.String(32), nullable=False) # Emoji

    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_id', 'emoji', name='_unique_reaction_per_target_emoji'),
    )

    users = db.relationship(
        "User",
        secondary=reaction_user,
        backref=db.backref("reactions", lazy="dynamic"),
        passive_deletes=True,
        lazy="selectin",
    )

    def count(self):
        return len(self.users)

    def to_dict(self):  
        return {
            "emoji": self.emoji,
            "count": self.count(),
            "user_ids": [u.id for u in self.users],
        }

