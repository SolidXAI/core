// Name pools for the firstName / lastName random generators (random-data.ts). Common given names
// and surnames, so generated people look like real users of an Indian, British or American app.
// A generator draws without repeats from these within a run, so a pool's size is the most
// distinct names one run can ask for.

export type NameLocale = "in" | "gb" | "us";

export const FIRST_NAMES: Record<NameLocale, readonly string[]> = {
  in: [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Kabir",
    "Aryan", "Dhruv", "Karan", "Nikhil", "Rahul", "Siddharth", "Varun", "Pranav", "Harsh", "Vikram",
    "Ananya", "Diya", "Priya", "Aadhya", "Saanvi", "Isha", "Kavya", "Meera", "Neha", "Pooja",
    "Riya", "Sneha", "Tanvi", "Shreya", "Aditi", "Divya", "Lakshmi", "Nisha", "Pallavi", "Swati",
    "Anjali", "Deepa", "Gauri", "Ira", "Jhanvi", "Kiara", "Mansi", "Radhika", "Sanya", "Zoya",
  ],
  gb: [
    "Oliver", "George", "Harry", "Jack", "Noah", "Charlie", "Thomas", "James", "William", "Henry",
    "Alfie", "Freddie", "Arthur", "Theo", "Leo", "Oscar", "Archie", "Joshua", "Samuel", "Edward",
    "Olivia", "Amelia", "Isla", "Ava", "Mia", "Ivy", "Lily", "Isabella", "Sophia", "Grace",
    "Freya", "Florence", "Poppy", "Evie", "Emily", "Ella", "Charlotte", "Alice", "Ruby", "Daisy",
    "Harriet", "Matilda", "Imogen", "Lucy", "Eleanor", "Rosie", "Phoebe", "Millie", "Holly", "Jessica",
  ],
  us: [
    "Liam", "Elijah", "Benjamin", "Lucas", "Mason", "Ethan", "Logan", "Jackson", "Aiden", "Carter",
    "Wyatt", "Caleb", "Hunter", "Ryan", "Tyler", "Brandon", "Austin", "Dylan", "Michael", "Daniel",
    "Emma", "Madison", "Abigail", "Harper", "Avery", "Scarlett", "Chloe", "Addison", "Hannah", "Brooklyn",
    "Savannah", "Taylor", "Kayla", "Ashley", "Megan", "Brittany", "Jasmine", "Natalie", "Samantha", "Paige",
    "Riley", "Morgan", "Sydney", "Lauren", "Zoe", "Victoria", "Aubrey", "Layla", "Stella", "Nora",
  ],
};

export const LAST_NAMES: Record<NameLocale, readonly string[]> = {
  in: [
    "Sharma", "Verma", "Gupta", "Patel", "Shah", "Mehta", "Iyer", "Iyengar", "Nair", "Menon",
    "Reddy", "Rao", "Naidu", "Pillai", "Kulkarni", "Deshpande", "Joshi", "Patil", "Pawar", "Chavan",
    "Banerjee", "Chatterjee", "Mukherjee", "Das", "Bose", "Sen", "Ghosh", "Singh", "Kaur", "Gill",
    "Malhotra", "Kapoor", "Khanna", "Chopra", "Bhatia", "Agarwal", "Jain", "Bansal", "Mishra", "Pandey",
    "Tiwari", "Dubey", "Yadav", "Rodrigues", "D'Souza", "Fernandes", "Pereira", "Khan", "Qureshi", "Hussain",
  ],
  gb: [
    "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright",
    "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke",
    "Hughes", "Edwards", "Lewis", "Turner", "Hill", "Moore", "Cooper", "Ward", "Morris", "King",
    "Harris", "Baker", "Harrison", "Morgan", "Martin", "Allen", "Mitchell", "Bennett", "Carter", "Shaw",
    "Lloyd", "Scott", "Price", "Phillips", "Parker", "Cook", "Bailey", "Kelly", "Murphy", "O'Brien",
  ],
  us: [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  ],
};
