from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

reaction_user = db.Table('reaction_user',
    db.Column('reaction_id', db.Integer, db.ForeignKey('reaction.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
)

class Reaction(db.Model):
    __tablename__ = 'reaction'

    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(50), nullable=False)  # 'chat', 'news', 'comment', etc.
    target_id = db.Column(db.Integer, nullable=False)
    emoji = db.Column(db.String(32), nullable=False)

    users = db.relationship("User", secondary=reaction_user, backref="reactions")

    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_id', 'emoji', name='_unique_reaction_per_target_emoji'),
    )

    def count(self):
        return len(self.users)

    def to_dict(self):
        return {
            "emoji": self.emoji,
            "count": self.count(),
            "user_ids": [user.id for user in self.users],
        }
