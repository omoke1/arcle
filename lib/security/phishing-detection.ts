/**
 * Phishing Detection System
 * 
 * Detects phishing URLs and malicious links in user messages
 */

export interface PhishingDetectionResult {
  isPhishing: boolean;
  confidence: number; // 0-100
  reasons: string[];
  detectedUrls: string[];
  blocked: boolean;
}

/**
 * Known phishing domains and patterns
 */
const KNOWN_PHISHING_DOMAINS = new Set<string>([
  // Common phishing domains (in production, this would be a database/API)
  "metamask-verify.com",
  "metamask-support.com",
  "wallet-connect.org",
  "uniswap-v2.com",
  "uniswap-v3.com",
  "opensea-verify.com",
]);

/**
 * Suspicious URL patterns
 */
const SUSPICIOUS_PATTERNS = [
  /metamask[^a-z]verify/i,
  /wallet[^a-z]connect/i,
  /uniswap[^a-z]v[23]/i,
  /opensea[^a-z]verify/i,
  /wallet[^a-z]recovery/i,
  /seed[^a-z]phrase/i,
  /private[^a-z]key/i,
  /verify[^a-z]wallet/i,
  /secure[^a-z]wallet/i,
  /wallet[^a-z]sync/i,
];

/**
 * Suspicious TLDs (Top Level Domains)
 */
const SUSPICIOUS_TLDS = new Set<string>([
  ".tk",
  ".ml",
  ".ga",
  ".cf",
  ".gq",
  ".xyz",
  ".top",
  ".click",
  ".download",
  ".stream",
]);

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;
  const matches = text.match(urlRegex) || [];
  return matches.filter(url => {
    // Filter out addresses that look like URLs but are actually Ethereum addresses
    return !/^0x[a-fA-F0-9]{40}$/.test(url);
  });
}

/**
 * Parse domain from URL
 */
function parseDomain(url: string): string | null {
  try {
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      fullUrl = `https://${url}`;
    }
    
    const urlObj = new URL(fullUrl);
    return urlObj.hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

/**
 * Check if domain is suspicious
 */
function isSuspiciousDomain(domain: string): { suspicious: boolean; reason?: string } {
  // Check against known phishing domains
  if (KNOWN_PHISHING_DOMAINS.has(domain)) {
    return { suspicious: true, reason: "Known phishing domain" };
  }
  
  // Check for suspicious TLDs
  for (const tld of SUSPICIOUS_TLDS) {
    if (domain.endsWith(tld)) {
      return { suspicious: true, reason: `Suspicious TLD: ${tld}` };
    }
  }
  
  // Check for typosquatting (similar to legitimate domains)
  const legitimateDomains = [
    "metamask.io",
    "uniswap.org",
    "opensea.io",
    "walletconnect.com",
    "arcscan.app",
    "circle.com",
  ];
  
  for (const legit of legitimateDomains) {
    const legitBase = legit.replace(/\.(com|io|org|app)$/, "");
    const domainBase = domain.replace(/\.(com|io|org|app|net|xyz|tk|ml|ga|cf|gq|top|click|download|stream)$/, "");
    
    // Check if domain is very similar to legitimate domain (typosquatting)
    if (domainBase.length > 3 && legitBase.length > 3) {
      const similarity = calculateSimilarity(domainBase, legitBase);
      if (similarity > 0.8 && domain !== legit) {
        return { suspicious: true, reason: `Possible typosquatting of ${legit}` };
      }
    }
  }
  
  return { suspicious: false };
}

/**
 * Calculate string similarity (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Check if URL matches suspicious patterns
 */
function matchesSuspiciousPattern(url: string): { matches: boolean; reason?: string } {
  const lowerUrl = url.toLowerCase();
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      return { matches: true, reason: `Matches suspicious pattern: ${pattern}` };
    }
  }
  
  return { matches: false };
}

/**
 * Analyze URL for phishing indicators
 */
function analyzeUrl(url: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Check domain
  const domain = parseDomain(url);
  if (domain) {
    const domainCheck = isSuspiciousDomain(domain);
    if (domainCheck.suspicious) {
      score += 50;
      reasons.push(domainCheck.reason || "Suspicious domain");
    }
  }
  
  // Check for suspicious patterns
  const patternCheck = matchesSuspiciousPattern(url);
  if (patternCheck.matches) {
    score += 40;
    reasons.push(patternCheck.reason || "Suspicious URL pattern");
  }
  
  // Check URL length (very long URLs can be suspicious)
  if (url.length > 100) {
    score += 10;
    reasons.push("Unusually long URL");
  }
  
  // Check for IP addresses (phishing sites sometimes use IPs)
  if (/^\d+\.\d+\.\d+\.\d+/.test(url)) {
    score += 30;
    reasons.push("URL uses IP address instead of domain");
  }
  
  // Check for excessive subdomains
  if (domain) {
    const subdomainCount = domain.split(".").length;
    if (subdomainCount > 4) {
      score += 15;
      reasons.push("Excessive subdomains");
    }
  }
  
  return { score: Math.min(score, 100), reasons };
}

/**
 * Detect phishing URLs in text
 */
export function detectPhishingUrls(text: string): PhishingDetectionResult {
  const urls = extractUrls(text);
  
  if (urls.length === 0) {
    return {
      isPhishing: false,
      confidence: 0,
      reasons: [],
      detectedUrls: [],
      blocked: false,
    };
  }
  
  let maxScore = 0;
  const allReasons: string[] = [];
  const suspiciousUrls: string[] = [];
  
  for (const url of urls) {
    const analysis = analyzeUrl(url);
    
    if (analysis.score > 0) {
      suspiciousUrls.push(url);
      maxScore = Math.max(maxScore, analysis.score);
      allReasons.push(...analysis.reasons);
    }
  }
  
  const isPhishing = maxScore >= 50;
  const blocked = maxScore >= 80;
  
  return {
    isPhishing,
    confidence: maxScore,
    reasons: [...new Set(allReasons)], // Remove duplicates
    detectedUrls: suspiciousUrls,
    blocked,
  };
}

/**
 * Add phishing domain to blacklist
 */
export function addPhishingDomain(domain: string): void {
  const normalized = domain.toLowerCase();
  KNOWN_PHISHING_DOMAINS.add(normalized);
  
  // Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("arcle_phishing_domains");
      const domainList = stored ? JSON.parse(stored) : [];
      if (!domainList.includes(normalized)) {
        domainList.push(normalized);
        localStorage.setItem("arcle_phishing_domains", JSON.stringify(domainList));
      }
    } catch (error) {
      console.error("Error saving phishing domain:", error);
    }
  }
}

/**
 * Load phishing domains from localStorage
 */
function loadPhishingDomains(): void {
  if (typeof window === "undefined") return;
  
  try {
    const stored = localStorage.getItem("arcle_phishing_domains");
    if (stored) {
      const domainList = JSON.parse(stored) as string[];
      domainList.forEach(domain => KNOWN_PHISHING_DOMAINS.add(domain.toLowerCase()));
    }
  } catch (error) {
    console.error("Error loading phishing domains:", error);
  }
}

// Load phishing domains on module initialization
if (typeof window !== "undefined") {
  loadPhishingDomains();
}

