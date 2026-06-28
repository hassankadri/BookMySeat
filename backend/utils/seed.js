const User = require('../models/User');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookmyseat.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin = new User({ name: 'Admin', email: adminEmail, password: hashedPassword, role: 'admin' });
      await admin.save();
      console.log('Admin user created');
    } else {
      const passwordMatch = await bcrypt.compare(adminPassword, admin.password);
      if (!passwordMatch) { admin.password = await bcrypt.hash(adminPassword, 10); await admin.save(); }
      console.log('Admin user already exists');
    }
    const credentialsPath = path.join(__dirname, '../../memory/test_credentials.md');
    const memoryDir = path.dirname(credentialsPath);
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(credentialsPath, `# Test Credentials\n\n## Admin\n- Email: ${adminEmail}\n- Password: ${adminPassword}\n- Role: admin\n\n## Test User\n- Email: user@test.com\n- Password: Test@123\n`);
  } catch (error) { console.error('Error seeding admin:', error); }
};

// Reliable Unsplash poster images (cinema/film themed)
const P = [
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1585951237313-1979e4df7385?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1601552653602-a4d82e47714d?w=400&h=600&fit=crop'
];
const B = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200';
const A = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop&crop=face'
];

const seedMovies = async () => {
  try {
    await Movie.deleteMany({});
    await Show.deleteMany({});

    const mainMovies = [
      { title:'Lakshya', description:'A directionless young man finds purpose and transforms into a brave soldier during the Kargil War.', genre:'Drama, War', duration:'3h 6m', rating:'U/A', poster:P[0], banner:B, trailer:'https://www.youtube.com/watch?v=YoKGmYyljmc', avgRating:4.6, releaseYear:2004, director:'Farhan Akhtar', producer:'Ritesh Sidhwani',
        cast:[{name:'Hrithik Roshan',role:'Lt. Karan Shergill',image:A[0]},{name:'Preity Zinta',role:'Romila Dutta',image:A[2]},{name:'Amitabh Bachchan',role:'Col. Sunil Damle',image:A[6]}] },
      { title:'Ghayal', description:'A boxer seeks justice for his murdered brother by taking on a powerful and corrupt industrialist.', genre:'Action, Drama', duration:'2h 40m', rating:'U/A', poster:P[1], banner:B, trailer:'https://www.youtube.com/watch?v=C2LRGRZ7lNs', avgRating:4.5, releaseYear:1990, director:'Rajkumar Santoshi', producer:'Dharmendra',
        cast:[{name:'Sunny Deol',role:'Ajay Mehra',image:A[0]},{name:'Meenakshi Seshadri',role:'Varsha',image:A[2]}] },
      { title:'Dil Chahta Hai', description:'Three inseparable childhood friends navigate the complexities of love, life, and growing up in modern India.', genre:'Comedy, Drama, Romance', duration:'3h 3m', rating:'U/A', poster:P[2], banner:B, trailer:'https://www.youtube.com/watch?v=m13b25V0B10', avgRating:4.8, releaseYear:2001, director:'Farhan Akhtar', producer:'Ritesh Sidhwani',
        cast:[{name:'Aamir Khan',role:'Akash',image:A[0]},{name:'Saif Ali Khan',role:'Sameer',image:A[1]},{name:'Preity Zinta',role:'Shalini',image:A[2]}] },
      { title:'Border', description:'Based on the Battle of Longewala during 1971 Indo-Pak War, depicting Indian soldiers defending against impossible odds.', genre:'War, Drama, Action', duration:'3h 20m', rating:'U/A', poster:P[3], banner:B, trailer:'https://www.youtube.com/watch?v=C9IBHKF7KMQ', avgRating:4.7, releaseYear:1997, director:'J.P. Dutta', producer:'J.P. Dutta',
        cast:[{name:'Sunny Deol',role:'Major Kuldip Singh',image:A[0]},{name:'Jackie Shroff',role:'Brig. Kuldeep Singh',image:A[7]},{name:'Suniel Shetty',role:'Bhairon Singh',image:A[4]}] },
      { title:'Ishq Vishk', description:'A college student pretends to have a girlfriend to make his real crush jealous, but the plan leads to unexpected complications.', genre:'Romance, Comedy', duration:'2h 14m', rating:'U/A', poster:P[4], banner:B, trailer:'https://www.youtube.com/watch?v=EaQqDe1hnAM', avgRating:3.9, releaseYear:2003, director:'Ken Ghosh', producer:'Ramesh Taurani',
        cast:[{name:'Shahid Kapoor',role:'Rajiv Mathur',image:A[1]},{name:'Amrita Rao',role:'Payal Mehra',image:A[3]}] },
      { title:'Kal Ho Naa Ho', description:'A terminally ill man brings joy into the lives of a pessimistic MBA student and her family. Living life to the fullest.', genre:'Romance, Drama, Comedy', duration:'3h 6m', rating:'U/A', poster:P[5], banner:B, trailer:'https://www.youtube.com/watch?v=tVMAQAsjsOU', avgRating:4.8, releaseYear:2003, director:'Nikkhil Advani', producer:'Karan Johar',
        cast:[{name:'Shah Rukh Khan',role:'Aman Mathur',image:A[0]},{name:'Preity Zinta',role:'Naina Kapur',image:A[2]},{name:'Saif Ali Khan',role:'Rohit Patel',image:A[1]}] },
      { title:'Swades', description:'A NASA scientist returns to India and discovers rural India\'s deep-rooted problems, inspiring him to stay and make a difference.', genre:'Drama', duration:'3h 10m', rating:'U', poster:P[6], banner:B, trailer:'https://www.youtube.com/watch?v=S4BqSoFRlIE', avgRating:4.9, releaseYear:2004, director:'Ashutosh Gowariker', producer:'Ashutosh Gowariker',
        cast:[{name:'Shah Rukh Khan',role:'Mohan Bhargava',image:A[0]},{name:'Gayatri Joshi',role:'Gita',image:A[5]}] },
      { title:'Salaam Namaste', description:'Two Indian expats in Melbourne face hilarious complications when an unexpected pregnancy tests their live-in relationship.', genre:'Romance, Comedy', duration:'2h 30m', rating:'U/A', poster:P[7], banner:B, trailer:'https://www.youtube.com/watch?v=PEBbpQcFpn0', avgRating:4.1, releaseYear:2005, director:'Siddharth Anand', producer:'Aditya Chopra',
        cast:[{name:'Saif Ali Khan',role:'Nikhil Arora',image:A[1]},{name:'Preity Zinta',role:'Ambar',image:A[2]}] },
      { title:'Garam Masala', description:'Two photographers juggle multiple girlfriends, leading to hilarious misunderstandings when all the women show up simultaneously.', genre:'Comedy', duration:'2h 28m', rating:'U/A', poster:P[8], banner:B, trailer:'https://www.youtube.com/watch?v=NRH7oHaTLfo', avgRating:4.0, releaseYear:2005, director:'Priyadarshan', producer:'Feroz Nadiadwala',
        cast:[{name:'Akshay Kumar',role:'Mac',image:A[7]},{name:'John Abraham',role:'Sam',image:A[4]}] },
      { title:'Indian', description:'An aged freedom fighter wages a one-man war against corruption, punishing corrupt officials with his own hands.', genre:'Action, Drama, Thriller', duration:'3h 5m', rating:'U/A', poster:P[9], banner:B, trailer:'https://www.youtube.com/watch?v=YrB2Oo2cNwI', avgRating:4.4, releaseYear:2001, director:'N. Maharajan', producer:'A.M. Rathnam',
        cast:[{name:'Sunny Deol',role:'Inspector Veer Pratap',image:A[0]},{name:'Shilpa Shetty',role:'Saraswati',image:A[5]}] },
      { title:'Coolie No. 1', description:'A matchmaker tricks a wealthy man into marrying his daughter to a coolie, leading to hilarious deceptions.', genre:'Comedy, Romance', duration:'2h 30m', rating:'U', poster:P[10], banner:B, trailer:'https://www.youtube.com/watch?v=KdJfb7gVd6E', avgRating:4.2, releaseYear:1995, director:'David Dhawan', producer:'Vashu Bhagnani',
        cast:[{name:'Govinda',role:'Raju',image:A[7]},{name:'Karisma Kapoor',role:'Malti',image:A[3]}] },
      { title:'Hera Pheri', description:'Three unlikely friends stumble upon a kidnapping scheme and hatch their own plan, leading to non-stop comedy of errors.', genre:'Comedy', duration:'2h 36m', rating:'U/A', poster:P[11], banner:B, trailer:'https://www.youtube.com/watch?v=m1zMmVwWr-M', avgRating:4.9, releaseYear:2000, director:'Priyadarshan', producer:'A. Ganesh Jain',
        cast:[{name:'Akshay Kumar',role:'Raju',image:A[7]},{name:'Paresh Rawal',role:'Baburao Apte',image:A[6]},{name:'Suniel Shetty',role:'Shyam',image:A[4]}] },
      { title:'Jodi No.1', description:'Two friends disguise themselves in various avatars to woo a wealthy woman, competing in a hilarious battle of deception.', genre:'Comedy, Romance', duration:'2h 40m', rating:'U', poster:P[12], banner:B, trailer:'https://www.youtube.com/watch?v=9vF3h8RJOAY', avgRating:3.8, releaseYear:2001, director:'David Dhawan', producer:'Afzal Khan',
        cast:[{name:'Govinda',role:'Veeru',image:A[7]},{name:'Sanjay Dutt',role:'Jai',image:A[4]}] },
      { title:'Mohabbatein', description:'A strict headmaster clashes with a free-spirited music teacher as love finds its way despite opposition.', genre:'Romance, Drama, Musical', duration:'3h 36m', rating:'U', poster:P[13], banner:B, trailer:'https://www.youtube.com/watch?v=NXZjmFuG0Gk', avgRating:4.5, releaseYear:2000, director:'Aditya Chopra', producer:'Yash Chopra',
        cast:[{name:'Amitabh Bachchan',role:'Narayan Shankar',image:A[6]},{name:'Shah Rukh Khan',role:'Raj Aryan',image:A[0]},{name:'Aishwarya Rai',role:'Megha',image:A[3]}] },
      { title:'Tere Naam', description:'A local goon falls deeply in love with a shy girl, but his obsessive love and tragic fate tear them apart.', genre:'Romance, Drama', duration:'2h 34m', rating:'U/A', poster:P[14], banner:B, trailer:'https://www.youtube.com/watch?v=x1B1gBF-jSc', avgRating:4.3, releaseYear:2003, director:'Satish Kaushik', producer:'Murad Khetani',
        cast:[{name:'Salman Khan',role:'Radhe Mohan',image:A[0]},{name:'Bhumika Chawla',role:'Nirjara',image:A[5]}] }
    ];

    const trendingMovies = [
      { title:'Vadh 2', description:'Sequel to the dark thriller where an ordinary man is pushed to extraordinary violence when justice fails.', genre:'Thriller, Crime', duration:'2h 15m', rating:'A', poster:P[9], banner:B, trailer:'https://www.youtube.com/watch?v=pDFk0LzLKpw', avgRating:4.2, releaseYear:2025, director:'J. Jaspal Singh', producer:'Luv Ranjan Films', trending:true, trendingRank:1, cast:[{name:'Sanjay Mishra',role:'Shambhu',image:A[6]}] },
      { title:'Mrithyunjay', description:'A mythological epic retelling the story of Karna from the Mahabharata.', genre:'Mythology, Drama', duration:'2h 50m', rating:'U/A', poster:P[0], banner:B, trailer:'https://www.youtube.com/watch?v=WSbAj42mxbM', avgRating:4.7, releaseYear:2025, director:'Prashanth Neel', producer:'Hombale Films', trending:true, trendingRank:2, cast:[{name:'Hrithik Roshan',role:'Karna',image:A[0]}] },
      { title:'Thrash', description:'An underground fighter struggles between brutal illegal fights and dreams of a legitimate life.', genre:'Action, Sports', duration:'2h 10m', rating:'A', poster:P[1], banner:B, trailer:'https://www.youtube.com/watch?v=D8HoFk3c5fo', avgRating:4.0, releaseYear:2025, director:'Aditya Dhar', producer:'B62 Studios', trending:true, trendingRank:3, cast:[{name:'Tiger Shroff',role:'Rocky',image:A[7]}] },
      { title:'Dhurandhar', description:'A retired intelligence officer is pulled back into action when a new terror threat emerges.', genre:'Thriller, Action, Spy', duration:'2h 30m', rating:'U/A', poster:P[6], banner:B, trailer:'https://www.youtube.com/watch?v=OBAcYSSUf6o', avgRating:4.5, releaseYear:2025, director:'Neeraj Pandey', producer:'Shital Bhatia', trending:true, trendingRank:4, cast:[{name:'Akshay Kumar',role:'Col. Vikram',image:A[7]}] },
      { title:'Sampradayani Suppini Sudhapoosani', description:'A cultural comedy exploring the clash between tradition and modernity in a South Indian family.', genre:'Comedy, Drama', duration:'2h 20m', rating:'U', poster:P[8], banner:B, trailer:'https://www.youtube.com/watch?v=VWkjjRejKgs', avgRating:4.1, releaseYear:2025, director:'Rishab Shetty', producer:'Hombale Films', trending:true, trendingRank:5, cast:[{name:'Rishab Shetty',role:'Shekhar',image:A[4]}] },
      { title:'Tu Yaa Main', description:'Two individuals choose between their ambitions and love in fast-paced Mumbai.', genre:'Romance, Drama', duration:'2h 5m', rating:'U/A', poster:P[5], banner:B, trailer:'https://www.youtube.com/watch?v=sssNBI7p_dE', avgRating:3.9, releaseYear:2025, director:'Imtiaz Ali', producer:'Sajid Nadiadwala', trending:true, trendingRank:6, cast:[{name:'Kartik Aaryan',role:'Arjun',image:A[1]}] },
      { title:'Mardaani 3', description:'Inspector Shivani takes on a dangerous international human trafficking ring.', genre:'Action, Crime, Thriller', duration:'2h 15m', rating:'A', poster:P[13], banner:B, trailer:'https://www.youtube.com/watch?v=SQbQ8xZkQ5A', avgRating:4.3, releaseYear:2025, director:'Gopi Puthran', producer:'Aditya Chopra', trending:true, trendingRank:7, cast:[{name:'Rani Mukerji',role:'Shivani Roy',image:A[5]}] },
      { title:'Anaconda', description:'Explorers encounter a monstrous snake in the Amazon. Indian remake of the classic thriller.', genre:'Horror, Adventure', duration:'2h 0m', rating:'U/A', poster:P[10], banner:B, trailer:'https://www.youtube.com/watch?v=tHh8jSKoBnI', avgRating:3.5, releaseYear:2025, director:'Shankar', producer:'Lyca Productions', trending:true, trendingRank:8, cast:[{name:'Ranveer Singh',role:'Dr. Aakash',image:A[7]}] },
      { title:'Vadh', description:'A retired school teacher and wife are driven to shocking violence when pushed beyond their limits.', genre:'Thriller, Crime', duration:'1h 57m', rating:'A', poster:P[14], banner:B, trailer:'https://www.youtube.com/watch?v=pDFk0LzLKpw', avgRating:4.4, releaseYear:2023, director:'J. Jaspal Singh', producer:'Luv Ranjan Films', trending:true, trendingRank:9, cast:[{name:'Sanjay Mishra',role:'Shambhu Mishra',image:A[6]}] },
      { title:'Border 2', description:'The much-awaited sequel. A new generation of soldiers carries forward the legacy of valor.', genre:'War, Action, Drama', duration:'3h 0m', rating:'U/A', poster:P[3], banner:B, trailer:'https://www.youtube.com/watch?v=C9IBHKF7KMQ', avgRating:4.6, releaseYear:2025, director:'Anurag Singh', producer:'Bhushan Kumar', trending:true, trendingRank:10, cast:[{name:'Sunny Deol',role:'Major Kuldip Singh',image:A[0]},{name:'Varun Dhawan',role:'Captain Arjun',image:A[1]}] }
    ];

    const allMovies = [...mainMovies, ...trendingMovies];
    const insertedMovies = await Movie.insertMany(allMovies);
    console.log(`${insertedMovies.length} movies seeded`);

    const today = new Date();
    const showsToCreate = [];
    for (const movie of insertedMovies) {
      for (let dayOffset = 1; dayOffset <= 2; dayOffset++) {
        const d = new Date(today); d.setDate(today.getDate() + dayOffset); d.setHours(0,0,0,0);
        showsToCreate.push({ movie: movie._id, date: d, time: '10:00 AM', price: 12.00 });
        showsToCreate.push({ movie: movie._id, date: d, time: '08:00 PM', price: 15.00 });
      }
    }
    await Show.insertMany(showsToCreate);
    console.log(`${showsToCreate.length} shows seeded`);
  } catch (error) { console.error('Error seeding movies:', error); }
};

module.exports = { seedAdmin, seedMovies };
