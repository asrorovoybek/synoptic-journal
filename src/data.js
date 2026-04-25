// --- Initial Data ---
export const initialSiteInfo = {
  name: "Synoptic: International Journal of Multidisciplinary Research",
  shortName: "SIJMR",
  tagline: "Advancing Global Knowledge Through Rigorous Interdisciplinary Research",
  issn: "2994-9580 (Online)",
  description: "Synoptic is a premier, double-blind peer-reviewed international journal dedicated to publishing high-quality research across all major academic disciplines. We bridge the gap between theory and practice.",
  scope: "Natural Sciences, Engineering, Health Sciences, Social Sciences, Arts, and Business Management.",
  submissionInfo: "Published monthly. We accept original research, reviews, and short communications.",
  deadline: "Manuscripts submitted by the 20th of each month will be considered for the upcoming issue.",
  email: "editor@synoptic-journal.org",
  address: "1250 Avenue of the Americas, New York, NY 10020, USA",
  phone: "+1 (212) 555-0198",
  ethics: "Synoptic follows COPE guidelines. Plagiarism is strictly prohibited. All manuscripts undergo a 24% similarity check."
};

export const initialAnnouncements = [
  { id: 'ann-1', title: "Call for Papers: June 2024 Issue", content: "Submit your research by June 20th for our upcoming multidisciplinary issue.", date: "2024/05/10" },
  { id: 'ann-2', title: "Indexing Update", content: "We are pleased to announce that Synoptic is now indexed in the Global Science Database.", date: "2024/04/28" }
];

export let editorialTeam = [
  { name: "Dr. Alexander Thompson", role: "Editor-in-Chief", institution: "Oxford University, UK" },
  { name: "Prof. Maria Rodriguez", role: "Associate Editor (Social Sciences)", institution: "University of Madrid, Spain" },
  { name: "Dr. Chen Wei", role: "Associate Editor (Technology)", institution: "Tsinghua University, China" },
  { name: "Dr. Sarah Johnson", role: "Associate Editor (Medicine)", institution: "Johns Hopkins University, USA" },
  { name: "Prof. Dmitri Volkov", role: "Editorial Board Member", institution: "Lomonosov Moscow State University, Russia" },
  { name: "Dr. Yuki Tanaka", role: "Editorial Board Member", institution: "University of Tokyo, Japan" },
  { name: "Prof. Elena Rossi", role: "Editorial Board Member", institution: "University of Bologna, Italy" },
  { name: "Dr. Ahmed Mansour", role: "Editorial Board Member", institution: "Cairo University, Egypt" },
  { name: "Dr. Linda Smith", role: "Editorial Board Member", institution: "Australian National University" },
  { name: "Prof. Karl Muller", role: "Editorial Board Member", institution: "Technical University of Munich, Germany" },
  { name: "Dr. Fatima Al-Sayed", role: "Editorial Board Member", institution: "King Saud University, Saudi Arabia" },
  { name: "Dr. Robert Black", role: "Editorial Board Member", institution: "Toronto University, Canada" },
  { name: "Prof. Jean Dupont", role: "Editorial Board Member", institution: "Sorbonne University, France" },
  { name: "Dr. Sanjay Gupta", role: "Editorial Board Member", institution: "Indian Institute of Technology, India" },
  { name: "Dr. Ana Silva", role: "Editorial Board Member", institution: "University of Sao Paulo, Brazil" }
];

export const initialIssues = [
  { id: 'iss-1', volume: "1", issueNumber: "1", year: "2024", month: "May", cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80", status: "Published" }
];

export const initialArticles = [
  {
    id: 'art-1',
    issueId: 'iss-1',
    title: "Quantum Neural Networks: A New Frontier in Interdisciplinary Computational Models",
    authors: [{ fullName: "Dr. Robert Chen", email: "chen@uni.edu", affiliation: "MIT, USA", orcid: "0000-0002-1825-0097" }],
    abstract: "This paper explores the convergence of quantum computing and neural network architectures. We propose a hybrid model that demonstrates superior efficiency in processing complex multidimensional datasets compared to classical systems.",
    type: "Original Research",
    doi: "10.5281/synoptic.2024.101",
    publicationDate: "2024/05/15",
    pdfPath: "uploads/article.pdf",
    references: ["Smith, J. (2023). Quantum Logic. Science.", "Doe, A. (2022). Neural Patterns. AI Journal."]
  }
];
