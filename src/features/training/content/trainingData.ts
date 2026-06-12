import type { TrainingCourse } from '@/shared/types';

export const trainingContent: TrainingCourse[] = [
  {
    id: 'wildfire-basics',
    title: 'Understanding Wildfire Risk',
    description: 'Learn how wildfires spread and what factors affect your property\'s risk.',
    estimatedMinutes: 20,
    badge: {
      id: 'badge-wildfire-basics',
      name: 'Fire Science',
      description: 'Completed wildfire basics training',
      imageUrl: '/badges/fire-science.png',
    },
    lessons: [
      {
        id: 'wildfire-basics-1',
        courseId: 'wildfire-basics',
        title: 'How Wildfires Spread',
        orderIndex: 0,
        content: [
          {
            type: 'text',
            content: `# How Wildfires Spread

Wildfires spread through three primary mechanisms, and understanding these is crucial for protecting your property.

## 1. Direct Flame Contact
When flames directly touch combustible materials like vegetation or structures, they can ignite new fires. This is why maintaining clearance around your home is so important.

## 2. Radiant Heat
Intense heat radiating from a fire can ignite materials even without direct flame contact. Materials can catch fire when exposed to temperatures as low as 400°F (200°C). Large fires generate enough radiant heat to ignite structures from 50-100 feet away.

## 3. Ember Attack (Flying Firebrands)
This is the #1 cause of structure ignition during wildfires. Embers can travel more than a mile ahead of the fire front, landing on roofs, in gutters, and in any small opening in your home.`,
          },
          {
            type: 'image',
            content: '/training/wildfire-spread.jpg',
            caption: 'The three ways wildfires spread to structures',
          },
        ],
        quiz: {
          id: 'quiz-wildfire-basics-1',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'What is the #1 cause of structure ignition during wildfires?',
              options: [
                'Direct flame contact',
                'Radiant heat',
                'Ember attack',
                'Lightning strikes',
              ],
              correctIndex: 2,
              explanation: 'Ember attack (flying firebrands) is responsible for the majority of structure ignitions during wildfires. Embers can travel over a mile ahead of the main fire.',
            },
            {
              id: 'q2',
              question: 'How far can embers travel ahead of a wildfire?',
              options: [
                'A few feet',
                'Up to 100 feet',
                'Up to 1/4 mile',
                'More than a mile',
              ],
              correctIndex: 3,
              explanation: 'Embers can travel more than a mile ahead of the fire front, which is why they are so dangerous and why home hardening is critical.',
            },
          ],
        },
      },
      {
        id: 'wildfire-basics-2',
        courseId: 'wildfire-basics',
        title: 'Risk Factors',
        orderIndex: 1,
        content: [
          {
            type: 'text',
            content: `# Wildfire Risk Factors

Several factors contribute to your property's wildfire risk level.

## Topography
- **Slope**: Fire spreads faster uphill. A fire doubles its spread rate for every 10° increase in slope.
- **Aspect**: South and west-facing slopes receive more sun and tend to be drier.
- **Terrain Features**: Canyons and saddles can channel wind and increase fire behavior.

## Vegetation
- **Fuel Type**: Different plants have different flammability levels.
- **Fuel Load**: The amount of combustible material present.
- **Fuel Moisture**: Dry vegetation ignites more easily.
- **Arrangement**: Continuous fuels allow fire to spread more easily.

## Weather
- **Wind**: Spreads embers and increases fire spread rate.
- **Humidity**: Low humidity dries out fuels.
- **Temperature**: Higher temps increase fire behavior.
- **Drought**: Extended dry periods increase risk significantly.

## Proximity
- **Wildland Interface**: Homes near wildland areas face higher risk.
- **Fire History**: Areas with previous fires may have changed vegetation.`,
          },
        ],
        quiz: {
          id: 'quiz-wildfire-basics-2',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'How does slope affect fire spread?',
              options: [
                'Fire spreads slower uphill',
                'Fire spreads faster uphill',
                'Slope has no effect',
                'Fire only spreads downhill',
              ],
              correctIndex: 1,
              explanation: 'Fire spreads faster uphill because flames preheat fuels above them. The spread rate roughly doubles for every 10° increase in slope.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'defensible-space',
    title: 'Defensible Space',
    description: 'Create and maintain the critical buffer zones around your home.',
    estimatedMinutes: 30,
    badge: {
      id: 'badge-defensible-space',
      name: 'Space Creator',
      description: 'Mastered defensible space principles',
      imageUrl: '/badges/defensible-space.png',
    },
    lessons: [
      {
        id: 'defensible-space-1',
        courseId: 'defensible-space',
        title: 'Zone 0: The Ember-Resistant Zone',
        orderIndex: 0,
        content: [
          {
            type: 'text',
            content: `# Zone 0: The Ember-Resistant Zone (0-5 feet)

Zone 0 is the most critical area for protecting your home from wildfire. This is the immediate area around your house where embers are most likely to accumulate and ignite.

## Requirements for Zone 0

### Remove ALL combustible materials:
- No plants (even fire-resistant ones)
- No mulch (wood, bark, or rubber)
- No dead leaves or needles
- No woodpiles or lumber
- No patio furniture with cushions
- No propane tanks or fuel containers

### Acceptable materials:
- Gravel, rock, or decomposed granite
- Concrete or brick pavers
- Stone or tile
- Irrigated herb gardens in containers

### Focus areas:
- Under decks and porches
- Along foundation walls
- Around windows and doors
- Near vents and eaves
- In rain gutters`,
          },
          {
            type: 'image',
            content: '/training/zone-0.jpg',
            caption: 'Zone 0 should be completely clear of combustible materials',
          },
        ],
        quiz: {
          id: 'quiz-defensible-space-1',
          passingScore: 80,
          questions: [
            {
              id: 'q1',
              question: 'How far does Zone 0 extend from your home?',
              options: ['0-2 feet', '0-5 feet', '0-30 feet', '0-100 feet'],
              correctIndex: 1,
              explanation: 'Zone 0 extends from 0-5 feet from your home. This is the ember-resistant zone where no combustible materials should be present.',
            },
            {
              id: 'q2',
              question: 'Which of these is acceptable in Zone 0?',
              options: [
                'Wood mulch',
                'Fire-resistant shrubs',
                'Gravel or decomposed granite',
                'Bark chips',
              ],
              correctIndex: 2,
              explanation: 'Only non-combustible materials like gravel, rock, or decomposed granite are acceptable in Zone 0. Even fire-resistant plants are not recommended.',
            },
          ],
        },
      },
      {
        id: 'defensible-space-2',
        courseId: 'defensible-space',
        title: 'Zone 1: Lean, Clean, and Green',
        orderIndex: 1,
        content: [
          {
            type: 'text',
            content: `# Zone 1: Lean, Clean, and Green (5-30 feet)

Zone 1 is your primary defensible space area. The goal is to reduce fire intensity by creating a lean, clean, and green landscape.

## "Lean" - Reduce Fuel Load
- Limit shrubs and small trees
- Remove dead plants and branches
- Keep grass mowed to 4 inches or less
- Avoid dense plantings

## "Clean" - Remove Debris
- Rake leaves and pine needles regularly
- Clear debris from under trees
- Remove dead branches from trees (up to 6-10 feet)
- Keep firewood at least 30 feet from structures

## "Green" - Maintain Plant Health
- Keep plants well-watered and irrigated
- Prune regularly to remove dead material
- Choose fire-resistant plants when possible
- Remove invasive species

## Spacing Guidelines
- Trees: Crown spacing of at least 10 feet
- Shrubs: Double the height between plants
- No vegetation directly under trees
- Create islands of plants rather than continuous coverage`,
          },
        ],
        quiz: {
          id: 'quiz-defensible-space-2',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'What is the recommended crown spacing between trees in Zone 1?',
              options: ['3 feet', '6 feet', '10 feet', '20 feet'],
              correctIndex: 2,
              explanation: 'Trees in Zone 1 should have at least 10 feet of crown spacing to prevent fire from spreading between trees.',
            },
          ],
        },
      },
      {
        id: 'defensible-space-3',
        courseId: 'defensible-space',
        title: 'Zone 2: Reduced Fuel Zone',
        orderIndex: 2,
        content: [
          {
            type: 'text',
            content: `# Zone 2: Reduced Fuel Zone (30-100 feet)

Zone 2 extends your defensible space and reduces the intensity of approaching fire.

## Goals for Zone 2
- Reduce fire intensity before it reaches Zone 1
- Create breaks in continuous vegetation
- Remove "ladder fuels" that allow fire to climb into tree canopies

## Vegetation Management
- Cut or mow annual grasses to 4 inches
- Create horizontal spacing between shrubs
- Remove dead and dying plants
- Prune lower tree branches to 6-10 feet
- Create fuel breaks along driveways and paths

## Tree Management
- Remove small conifers growing between mature trees
- Reduce dense stands of trees
- Space trees so crowns don't touch
- Remove dead trees and branches

## On Steep Slopes
- Extend Zone 2 beyond 100 feet on downhill slopes
- Fire climbs slopes quickly
- Embers roll downhill into vegetation`,
          },
        ],
        quiz: {
          id: 'quiz-defensible-space-3',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'What are "ladder fuels"?',
              options: [
                'Fuel tanks near ladders',
                'Vegetation that allows fire to climb from ground to tree canopy',
                'Fuels stored on ladders',
                'Debris on roof ladders',
              ],
              correctIndex: 1,
              explanation: 'Ladder fuels are vegetation arranged in a way that allows fire to climb from the ground into tree canopies. This includes shrubs under trees and low-hanging branches.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'home-hardening',
    title: 'Home Hardening',
    description: 'Make your home more resistant to embers and radiant heat.',
    estimatedMinutes: 35,
    badge: {
      id: 'badge-home-hardening',
      name: 'Home Defender',
      description: 'Learned home hardening techniques',
      imageUrl: '/badges/home-hardening.png',
    },
    lessons: [
      {
        id: 'home-hardening-1',
        courseId: 'home-hardening',
        title: 'Roof and Gutters',
        orderIndex: 0,
        content: [
          {
            type: 'text',
            content: `# Roof and Gutters: Your First Line of Defense

The roof is the most vulnerable part of your home during a wildfire. Embers landing on your roof can ignite debris or penetrate through gaps.

## Roof Materials
**Class A Rated (Best):**
- Composition/asphalt shingles
- Metal roofing
- Concrete/clay tile
- Slate

**Avoid:**
- Wood shake/shingles (highly flammable)
- Untreated wood

## Gutter Protection
- Install metal or non-combustible gutters
- Add gutter guards to prevent debris accumulation
- Clean gutters at least twice per year
- Inspect and clean before fire season

## Roof Maintenance
- Remove debris (leaves, needles, branches)
- Check for and seal any gaps or openings
- Inspect roof vents for proper screening
- Replace damaged or missing shingles
- Ensure roof-to-wall connections are sealed`,
          },
        ],
        quiz: {
          id: 'quiz-home-hardening-1',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'Which roofing material is considered most fire-resistant?',
              options: [
                'Wood shake',
                'Class A rated materials like metal or tile',
                'Untreated wood shingles',
                'Plastic tiles',
              ],
              correctIndex: 1,
              explanation: 'Class A fire-rated materials like metal, tile, and composition shingles provide the best fire resistance for roofs.',
            },
          ],
        },
      },
      {
        id: 'home-hardening-2',
        courseId: 'home-hardening',
        title: 'Vents and Openings',
        orderIndex: 1,
        content: [
          {
            type: 'text',
            content: `# Protecting Vents and Openings

Embers can enter your home through any opening larger than 1/8 inch. Vents are particularly vulnerable.

## Types of Vents to Address
- Attic vents (gable, ridge, soffit)
- Foundation/crawl space vents
- Dryer vents
- Bathroom exhaust vents
- Kitchen range hood vents

## Solutions

### 1/8-Inch Metal Mesh Screening
- Cover all vents with 1/8-inch corrosion-resistant metal mesh
- Larger mesh (1/4 inch) is NOT effective against embers
- Smaller mesh (1/16 inch) can clog with debris

### Specialized Ember-Resistant Vents
- Intumescent vents that close during fire exposure
- Baffled vent designs that block embers
- Available for most vent types

### Eave and Soffit Protection
- Box in open eaves
- Use ignition-resistant materials
- Seal any gaps or openings

## Other Openings
- Seal gaps around pipes and wires
- Install weather stripping on garage doors
- Check attic and crawl space access points`,
          },
        ],
        quiz: {
          id: 'quiz-home-hardening-2',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'What mesh size is recommended for vent screening?',
              options: ['1/4 inch', '1/8 inch', '1/2 inch', '1 inch'],
              correctIndex: 1,
              explanation: '1/8-inch metal mesh is the recommended size. It blocks embers while still allowing adequate airflow. Larger mesh sizes allow embers through.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'emergency-prep',
    title: 'Emergency Preparedness',
    description: 'Prepare your family and property for wildfire evacuation.',
    estimatedMinutes: 25,
    badge: {
      id: 'badge-emergency-prep',
      name: 'Ready to Go',
      description: 'Completed emergency preparedness training',
      imageUrl: '/badges/emergency-prep.png',
    },
    lessons: [
      {
        id: 'emergency-prep-1',
        courseId: 'emergency-prep',
        title: 'Creating an Evacuation Plan',
        orderIndex: 0,
        content: [
          {
            type: 'text',
            content: `# Creating Your Evacuation Plan

When a wildfire threatens, you may have only minutes to evacuate. Having a plan in place is essential.

## Know Your Routes
- Identify at least 2 evacuation routes from your home
- Practice driving these routes at different times
- Know alternative routes in case primary routes are blocked
- Keep maps in your vehicle

## Designate Meeting Points
- Choose a meeting place outside your neighborhood
- Have an out-of-area contact everyone can check in with
- Ensure all family members know the plan

## Create a Communication Plan
- List emergency contacts
- Program local emergency numbers
- Sign up for emergency alerts in your area
- Know how to get information during emergencies

## Plan for Everyone
- Include plans for elderly family members
- Account for pets and livestock
- Consider neighbors who may need assistance
- Make arrangements for children at school`,
          },
        ],
        quiz: {
          id: 'quiz-emergency-prep-1',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'How many evacuation routes should you identify from your home?',
              options: ['1', 'At least 2', 'Exactly 3', "You don't need to plan routes"],
              correctIndex: 1,
              explanation: 'You should identify at least 2 evacuation routes from your home in case one is blocked by fire or traffic.',
            },
          ],
        },
      },
      {
        id: 'emergency-prep-2',
        courseId: 'emergency-prep',
        title: 'Your Go-Bag Essentials',
        orderIndex: 1,
        content: [
          {
            type: 'text',
            content: `# Your Go-Bag Essentials

A "Go-Bag" contains everything you need for at least 72 hours away from home.

## Documents (Keep copies in waterproof container)
- Identification (passport, driver's license)
- Insurance policies
- Property deeds/rental agreements
- Medical records and prescriptions
- Financial documents
- Family photos and irreplaceable items

## Supplies
- Water (1 gallon per person per day)
- Non-perishable food
- First aid kit
- Flashlight and extra batteries
- Battery-powered or hand-crank radio
- Phone chargers (battery-powered)
- Cash in small bills
- Medications (2-week supply)

## Clothing and Personal Items
- Change of clothes for each family member
- Sturdy shoes
- Personal hygiene items
- Glasses/contacts

## For Pets
- Food and water for 3 days
- Medications
- Leash, carrier, or crate
- Vaccination records
- Recent photos

## Keep Your Go-Bag:
- In an easily accessible location
- Ready to grab in 5 minutes or less
- Updated regularly (check expiration dates)`,
          },
        ],
        quiz: {
          id: 'quiz-emergency-prep-2',
          passingScore: 70,
          questions: [
            {
              id: 'q1',
              question: 'How much water should you include per person per day in your Go-Bag?',
              options: ['1 cup', '1 quart', '1 gallon', '2 gallons'],
              correctIndex: 2,
              explanation: 'The recommended amount is 1 gallon of water per person per day for drinking and basic sanitation.',
            },
          ],
        },
      },
    ],
  },
];
