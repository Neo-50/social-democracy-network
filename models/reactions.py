from db_init import db

class Reaction(db.Model):
    __tablename__ = 'reaction'
    
    id = db.Column(db.Integer, primary_key=True) # Reaction ID
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False) # User ID number
    target_type = db.Column(db.String(50), nullable=False)  # News, Messages, Chat
    target_id = db.Column(db.Integer, nullable=False) # Comment or Message ID
    emoji = db.Column(db.String(32), nullable=False) # Emoji

    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_id', 'emoji', name='_unique_reaction_per_target_emoji'),
    )

    def count(self):
        return 1  # each row is one user's reaction

    def to_dict(self):  
        return {
            "emoji": self.emoji,
            "count": self.count(),
            "user_ids": [self.user.id],
        }
