// ========== EXERCISE DATABASE ==========
const EXERCISES = {
  strength: [
    { id: 's1', name: 'Bench Press', muscles: 'Chest, Triceps', sets: 4, reps: '8-10', icon: '🏋️' },
    { id: 's2', name: 'Squat', muscles: 'Quads, Glutes', sets: 4, reps: '8-10', icon: '🦵' },
    { id: 's3', name: 'Deadlift', muscles: 'Back, Hamstrings', sets: 4, reps: '6-8', icon: '💪' },
    { id: 's4', name: 'Overhead Press', muscles: 'Shoulders, Triceps', sets: 3, reps: '8-10', icon: '🏋️' },
    { id: 's5', name: 'Barbell Row', muscles: 'Back, Biceps', sets: 4, reps: '8-10', icon: '💪' },
    { id: 's6', name: 'Pull-Up', muscles: 'Back, Biceps', sets: 3, reps: '8-12', icon: '🔝' },
    { id: 's7', name: 'Dumbbell Curl', muscles: 'Biceps', sets: 3, reps: '10-12', icon: '💪' },
    { id: 's8', name: 'Tricep Dips', muscles: 'Triceps, Chest', sets: 3, reps: '10-12', icon: '🏋️' },
    { id: 's9', name: 'Leg Press', muscles: 'Quads, Glutes', sets: 4, reps: '10-12', icon: '🦵' },
    { id: 's10', name: 'Lateral Raise', muscles: 'Shoulders', sets: 3, reps: '12-15', icon: '🏋️' },
    { id: 's11', name: 'Chest Fly', muscles: 'Chest', sets: 3, reps: '10-12', icon: '🏋️' },
    { id: 's12', name: 'Hammer Curl', muscles: 'Biceps, Forearms', sets: 3, reps: '10-12', icon: '💪' },
  ],
  cardio: [
    { id: 'c1', name: 'Running', muscles: 'Full Body', sets: 1, reps: '30 min', icon: '🏃' },
    { id: 'c2', name: 'Jump Rope', muscles: 'Full Body', sets: 3, reps: '3 min', icon: '⏫' },
    { id: 'c3', name: 'Cycling', muscles: 'Legs, Cardio', sets: 1, reps: '30 min', icon: '🚴' },
    { id: 'c4', name: 'Burpees', muscles: 'Full Body', sets: 3, reps: '15', icon: '🔥' },
    { id: 'c5', name: 'Mountain Climbers', muscles: 'Core, Cardio', sets: 3, reps: '20', icon: '⛰️' },
    { id: 'c6', name: 'High Knees', muscles: 'Legs, Cardio', sets: 3, reps: '30 sec', icon: '🏃' },
    { id: 'c7', name: 'Box Jumps', muscles: 'Legs, Power', sets: 3, reps: '12', icon: '📦' },
    { id: 'c8', name: 'Rowing', muscles: 'Full Body', sets: 1, reps: '20 min', icon: '🚣' },
  ],
  fatLoss: [
    { id: 'f1', name: 'HIIT Circuit', muscles: 'Full Body', sets: 4, reps: '45 sec', icon: '🔥' },
    { id: 'f2', name: 'Kettlebell Swing', muscles: 'Full Body', sets: 4, reps: '15', icon: '🏋️' },
    { id: 'f3', name: 'Battle Ropes', muscles: 'Arms, Core', sets: 3, reps: '30 sec', icon: '🪢' },
    { id: 'f4', name: 'Plank to Push-Up', muscles: 'Core, Arms', sets: 3, reps: '10', icon: '💪' },
    { id: 'f5', name: 'Squat Jumps', muscles: 'Legs, Power', sets: 3, reps: '15', icon: '🦵' },
    { id: 'f6', name: 'Lunge Walk', muscles: 'Legs, Glutes', sets: 3, reps: '20', icon: '🚶' },
  ],
  muscleGain: [
    { id: 'm1', name: 'Incline Bench Press', muscles: 'Upper Chest', sets: 4, reps: '8-10', icon: '🏋️' },
    { id: 'm2', name: 'Romanian Deadlift', muscles: 'Hamstrings', sets: 4, reps: '8-10', icon: '💪' },
    { id: 'm3', name: 'Cable Cross', muscles: 'Chest', sets: 3, reps: '12-15', icon: '🏋️' },
    { id: 'm4', name: 'Bulgarian Split Squat', muscles: 'Quads, Glutes', sets: 3, reps: '10', icon: '🦵' },
    { id: 'm5', name: 'Preacher Curl', muscles: 'Biceps', sets: 3, reps: '10-12', icon: '💪' },
    { id: 'm6', name: 'Skull Crushers', muscles: 'Triceps', sets: 3, reps: '10-12', icon: '🏋️' },
    { id: 'm7', name: 'Face Pull', muscles: 'Rear Delts', sets: 3, reps: '15', icon: '🏋️' },
    { id: 'm8', name: 'Leg Curl', muscles: 'Hamstrings', sets: 3, reps: '12', icon: '🦵' },
  ]
};

// ========== WORKOUT PLANS ==========
const WORKOUT_PLANS = [
  {
    id: 'p1', name: 'Push Power', category: 'strength', duration: '45 min', level: 'Intermediate',
    description: 'Build upper body pushing strength with compound movements.',
    exercises: ['s1','s4','s8','s10','s11'],
    calories: 320
  },
  {
    id: 'p2', name: 'Pull Day', category: 'strength', duration: '45 min', level: 'Intermediate',
    description: 'Target your back and biceps with heavy pulling exercises.',
    exercises: ['s5','s6','s7','s12'],
    calories: 290
  },
  {
    id: 'p3', name: 'Leg Destroyer', category: 'muscleGain', duration: '50 min', level: 'Advanced',
    description: 'Intense leg workout for maximum muscle growth.',
    exercises: ['s2','s9','m4','m8','f5'],
    calories: 420
  },
  {
    id: 'p4', name: 'HIIT Burn', category: 'fatLoss', duration: '30 min', level: 'Beginner',
    description: 'High intensity interval training to maximize fat burn.',
    exercises: ['f1','c4','c5','f5','c6'],
    calories: 380
  },
  {
    id: 'p5', name: 'Cardio Blast', category: 'cardio', duration: '35 min', level: 'Beginner',
    description: 'Get your heart pumping with this cardio-focused session.',
    exercises: ['c1','c2','c6','c7'],
    calories: 350
  },
  {
    id: 'p6', name: 'Full Body Power', category: 'muscleGain', duration: '60 min', level: 'Advanced',
    description: 'Complete full body workout targeting all major muscle groups.',
    exercises: ['s1','s2','s5','s4','s9','s7'],
    calories: 480
  },
  {
    id: 'p7', name: 'Core Shred', category: 'fatLoss', duration: '25 min', level: 'Intermediate',
    description: 'Torch your core and burn calories with this focused session.',
    exercises: ['f3','f4','c5','f1'],
    calories: 260
  },
  {
    id: 'p8', name: 'Upper Hypertrophy', category: 'muscleGain', duration: '55 min', level: 'Advanced',
    description: 'High volume upper body for maximum muscle hypertrophy.',
    exercises: ['m1','m3','s6','m5','m6','m7'],
    calories: 360
  }
];

// ========== MOTIVATIONAL QUOTES ==========
const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Push yourself, because no one else is going to do it for you.",
  "Success starts with self-discipline.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Don't stop when you're tired. Stop when you're done.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Wake up. Work out. Look hot. Kick ass.",
  "Strive for progress, not perfection.",
  "Train insane or remain the same.",
  "Sweat is just fat crying.",
  "The body achieves what the mind believes.",
  "Fall in love with taking care of your body."
];

// ========== AI RESPONSES ==========
const AI_KNOWLEDGE = {
  greetings: [
    "Hey champion! 💪 How can I help you crush your fitness goals today?",
    "What's up! Ready to level up your training? Ask me anything!",
    "Hey there! Your AI gym coach is ready. What do you need?"
  ],
  workoutSuggestions: {
    'muscle gain': "For muscle gain, I recommend:\n\n🏋️ **Push/Pull/Legs Split**\n• 4-5 days per week\n• Focus on compound lifts (bench, squat, deadlift)\n• Progressive overload: add weight each week\n• 8-12 rep range for hypertrophy\n• Rest 60-90 seconds between sets\n\nTry our 'Full Body Power' or 'Upper Hypertrophy' plans!",
    'fat loss': "For fat loss, here's your game plan:\n\n🔥 **HIIT + Strength Combo**\n• 3 strength days + 2 HIIT days\n• Keep heart rate elevated\n• Circuit-style training\n• Short rest periods (30-45 sec)\n• Caloric deficit is key\n\nCheck out 'HIIT Burn' or 'Core Shred' plans!",
    'strength': "For building raw strength:\n\n💪 **5x5 Program**\n• Focus on the big 3: squat, bench, deadlift\n• Low reps (3-6), heavy weight\n• 3-5 min rest between sets\n• Progressive overload is everything\n• Train 3-4 days per week\n\nTry our 'Push Power' or 'Pull Day' plans!",
    'cardio': "For cardio improvement:\n\n🏃 **Mixed Cardio Protocol**\n• 2 steady-state sessions (30-45 min)\n• 2 HIIT sessions (15-20 min)\n• Zone 2 training for endurance\n• Include variety: run, cycle, row\n\nCheck out 'Cardio Blast' plan!"
  },
  nutrition: "💡 **Nutrition Basics:**\n\n• **Protein**: 1.6-2.2g per kg bodyweight\n• **Calories**: Track with an app\n• **Meal Timing**: Eat within 2 hrs of training\n• **Hydration**: 3-4 liters of water daily\n• **Sleep**: 7-9 hours for recovery\n\nRemember: You can't out-train a bad diet! 🥗",
  recovery: "🧘 **Recovery Tips:**\n\n• Sleep 7-9 hours minimum\n• Stretch after every workout\n• Foam roll tight muscles\n• Take 1-2 rest days per week\n• Active recovery: light walking, yoga\n• Cold showers can help reduce inflammation\n• Stay hydrated throughout the day",
  motivation: [
    "Remember why you started! Every rep counts, every session builds the new you. You're stronger than you think! 🔥",
    "Champions aren't born, they're built — one workout at a time. Keep showing up! 💪",
    "The hardest part is showing up. You've already done that. Now crush it! 🏆"
  ],
  fallback: [
    "Great question! While I'm focused on fitness, I'd recommend talking to a certified trainer for specific advice. In the meantime, want me to suggest a workout plan? 💪",
    "I'm here to help with workouts, nutrition, and fitness goals! Try asking me about workout plans, nutrition tips, or recovery strategies.",
    "Hmm, that's outside my expertise. But I can help you with: workout plans, exercise tips, nutrition advice, or recovery strategies! What interests you?"
  ]
};

function getAIResponse(msg) {
  const m = msg.toLowerCase();
  if (m.match(/^(hi|hey|hello|sup|yo)/)) return AI_KNOWLEDGE.greetings[Math.floor(Math.random() * AI_KNOWLEDGE.greetings.length)];
  if (m.includes('muscle') || m.includes('bulk') || m.includes('mass') || m.includes('hypertrophy')) return AI_KNOWLEDGE.workoutSuggestions['muscle gain'];
  if (m.includes('fat') || m.includes('lose') || m.includes('weight loss') || m.includes('lean') || m.includes('cut')) return AI_KNOWLEDGE.workoutSuggestions['fat loss'];
  if (m.includes('strong') || m.includes('strength') || m.includes('power')) return AI_KNOWLEDGE.workoutSuggestions['strength'];
  if (m.includes('cardio') || m.includes('run') || m.includes('endurance') || m.includes('stamina')) return AI_KNOWLEDGE.workoutSuggestions['cardio'];
  if (m.includes('eat') || m.includes('food') || m.includes('diet') || m.includes('nutrition') || m.includes('protein') || m.includes('calori')) return AI_KNOWLEDGE.nutrition;
  if (m.includes('rest') || m.includes('recover') || m.includes('sleep') || m.includes('sore')) return AI_KNOWLEDGE.recovery;
  if (m.includes('motivat') || m.includes('tired') || m.includes('give up') || m.includes('lazy') || m.includes('can\'t')) return AI_KNOWLEDGE.motivation[Math.floor(Math.random() * AI_KNOWLEDGE.motivation.length)];
  if (m.includes('workout') || m.includes('plan') || m.includes('suggest') || m.includes('recommend')) return "What's your primary goal? I can suggest a plan for:\n\n💪 Muscle Gain\n🔥 Fat Loss\n🏋️ Strength\n🏃 Cardio\n\nJust tell me your goal!";
  if (m.includes('beginner') || m.includes('start') || m.includes('new')) return "Welcome to your fitness journey! 🎉\n\nFor beginners, I recommend:\n• Start with 3 days/week\n• Full body workouts\n• Master form before adding weight\n• Try our 'HIIT Burn' or 'Cardio Blast' plans\n• Stay consistent — results take 4-8 weeks\n\nYou've got this! 💪";
  return AI_KNOWLEDGE.fallback[Math.floor(Math.random() * AI_KNOWLEDGE.fallback.length)];
}

function getExerciseById(id) {
  for (const cat of Object.values(EXERCISES)) {
    const ex = cat.find(e => e.id === id);
    if (ex) return ex;
  }
  return null;
}

function getAllExercises() {
  return Object.values(EXERCISES).flat();
}

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
