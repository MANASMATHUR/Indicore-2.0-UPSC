import mongoose from 'mongoose';

const PyqSchema = new mongoose.Schema({
  exam: { 
    type: String, 
    required: true,
    uppercase: true,
    trim: true,
    enum: ['UPSC', 'PCS', 'SSC', 'TNPSC', 'MPSC', 'BPSC', 'UPPSC', 'MPPSC', 'RAS', 'RPSC', 'GPSC', 'KPSC', 'WBPSC', 'PPSC', 'OPSC', 'APSC', 'APPSC', 'TSPSC', 'HPSC', 'JKPSC', 'KERALA PSC', 'GOA PSC'],
    index: true 
  },
  level: { 
    type: String, 
    trim: true,
    enum: ['Prelims', 'Mains', 'Interview', ''],
    default: '' 
  },
  paper: { 
    type: String, 
    trim: true,
    default: '' 
  },
  year: { 
    type: Number, 
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 1,
    index: true 
  },
  question: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 10
  },
  answer: {
    type: String,
    trim: true,
    default: ''
  },
  lang: {
    type: String,
    trim: true,
    default: 'en',
    enum: ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'as', 'ur', 'ne', 'si', 'multi'],
    index: true
  },
  topicTags: { 
    type: [String], 
    default: [],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.every(tag => typeof tag === 'string' && tag.trim().length > 0);
      },
      message: 'Topic tags must be an array of non-empty strings'
    }
  },
  theme: { 
    type: String, 
    trim: true,
    default: '',
    index: true 
  },
  sourceLink: { 
    type: String, 
    trim: true,
    default: '' 
  },
  verified: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Normalize exam name before saving
PyqSchema.pre('save', function(next) {
  if (this.exam) {
    this.exam = this.exam.toUpperCase().trim();
  }
  if (this.level) {
    this.level = this.level.trim();
  }
  if (this.paper) {
    this.paper = this.paper.trim();
  }
  if (this.question) {
    this.question = this.question.trim();
  }
  if (this.answer) {
    this.answer = this.answer.trim();
  }
  if (this.theme) {
    this.theme = this.theme.trim();
  }
  if (this.topicTags && Array.isArray(this.topicTags)) {
    this.topicTags = this.topicTags.map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  
  // Set default lang if not set (language detection should be done before saving)
  if (!this.lang) {
    this.lang = 'en';
  }
  
  this.updatedAt = new Date();
  next();
});

// Create compound indexes for efficient queries
PyqSchema.index({ exam: 1, year: -1 }); // Most common query pattern
PyqSchema.index({ exam: 1, level: 1, year: -1 }); // Exam + level + year
PyqSchema.index({ exam: 1, paper: 1, year: -1 }); // Exam + paper + year
PyqSchema.index({ exam: 1, theme: 1, year: -1 }); // Exam + theme + year
PyqSchema.index({ exam: 1, verified: 1, year: -1 }); // Exam + verified + year
PyqSchema.index({ paper: 1, theme: 1, year: -1 }); // Paper + theme + year
PyqSchema.index({ exam: 1, lang: 1, year: -1 }); // Exam + lang + year
PyqSchema.index({ lang: 1, year: -1 }); // Lang + year

// Text index for full-text search (only if text index is supported)
try {
  PyqSchema.index({ 
    question: 'text', 
    answer: 'text',
    topicTags: 'text', 
    theme: 'text' 
  }, {
    name: 'pyq_text_index',
    weights: {
      question: 10,
      answer: 8,
      theme: 5,
      topicTags: 3
    }
  });
} catch (e) {
  // Text index may already exist or not be supported
}

// Compound index for duplicate detection (not unique to avoid issues with existing duplicates)
// Include lang to properly handle multi-language questions
PyqSchema.index(
  { exam: 1, year: 1, question: 1, lang: 1 },
  { 
    name: 'pyq_question_lookup'
  }
);

// Virtual for normalized question hash (for duplicate detection)
PyqSchema.virtual('questionHash').get(function() {
  return this.question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // Use first 200 chars for hash
});

export default mongoose.models.PYQ || mongoose.model('PYQ', PyqSchema);


