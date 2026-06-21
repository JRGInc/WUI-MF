import { Link } from 'react-router-dom';
import { LegalLayout } from './components/LegalLayout';

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="June 20, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Wildfire Risk Assessment
        application and related services (the &ldquo;Service&rdquo;) provided by{' '}
        <strong>JANUS Research Group LLC</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By
        accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not
        use the Service.
      </p>

      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
        <strong>Use at your own risk.</strong> The Service provides informational wildfire-risk estimates
        only. It is <strong>not</strong> a substitute for professional inspection, official fire-agency
        guidance, or emergency instructions. Do not rely on it for life-safety, evacuation, or insurance
        decisions. You use the Service entirely at your own risk.
      </div>

      <h2>1. Acceptance &amp; Eligibility</h2>
      <p>
        You must be at least 16 years old (or the age of majority in your jurisdiction) and capable of
        entering a binding contract to use the Service. If you use the Service on behalf of an
        organization, you represent that you are authorized to bind it to these Terms.
      </p>

      <h2>2. Nature of the Service &mdash; Informational Only</h2>
      <p>
        The Service generates wildfire-risk assessments, scores, findings, and recommendations using
        user-provided information, location data, and automated and AI/ML techniques. These outputs are{' '}
        <strong>estimates that may be incomplete, inaccurate, or out of date</strong>. They are provided
        for general informational and educational purposes only and do not constitute professional,
        engineering, fire-protection, legal, financial, or insurance advice.
      </p>
      <p>
        Wildfire behavior is unpredictable and conditions change rapidly. Always follow the instructions
        of local fire authorities and emergency services, and obtain a professional assessment for
        decisions that affect safety or property.
      </p>

      <h2>3. Your Account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your credentials and for all activity
        under your account. Notify us promptly of any unauthorized use.
      </p>

      <h2>4. Acceptable Use</h2>
      <ul>
        <li>Do not use the Service unlawfully or to infringe the rights of others.</li>
        <li>Do not upload content you lack the rights to, or that is unlawful or harmful.</li>
        <li>Do not interfere with, reverse engineer, or attempt to disrupt the Service or its security.</li>
        <li>Do not misrepresent assessment results as official or authoritative.</li>
      </ul>

      <h2>5. User Content &amp; Licenses</h2>
      <p>
        You retain ownership of the content you submit (including photos, property data, and
        annotations). You grant us a worldwide, non-exclusive license to host, store, process, and
        display that content as needed to operate and improve the Service. Our use of your content is
        described in our <Link to="/privacy">Privacy Policy</Link>, including the use of consented
        photographs to train our models and the use and sharing of non-photo data with public-safety
        organizations (and, in the future, potentially insurance providers and advertising partners as
        described in that Policy). As stated in that Policy, we do not share your photos with those third
        parties. You represent that you have the rights necessary to grant these licenses, including any
        rights relating to properties or individuals depicted.
      </p>

      <h2>6. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED <strong>&ldquo;AS IS&rdquo;</strong> AND{' '}
        <strong>&ldquo;AS AVAILABLE,&rdquo;</strong> WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
        IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE OR ANY RISK ASSESSMENT
        WILL BE ACCURATE, RELIABLE, COMPLETE, UNINTERRUPTED, OR ERROR-FREE.
      </p>

      <h2>7. Assumption of Risk</h2>
      <p>
        You acknowledge that wildfire risk involves inherent danger and uncertainty, that the Service
        relies on data you provide and automated estimates, and that you assume all risk arising from
        your use of, or reliance on, the Service and its outputs. You are solely responsible for
        verifying information and for decisions you make.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, <strong>JANUS Research Group LLC</strong> AND ITS AFFILIATES,
        OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, PROPERTY, OR
        GOODWILL, OR FOR PERSONAL INJURY OR PROPERTY DAMAGE, ARISING FROM OR RELATED TO YOUR USE OF (OR
        INABILITY TO USE) THE SERVICE OR RELIANCE ON ANY ASSESSMENT, EVEN IF ADVISED OF THE POSSIBILITY
        OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ALL CLAIMS WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU
        PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR USD $100. SOME JURISDICTIONS DO NOT ALLOW CERTAIN
        LIMITATIONS, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.
      </p>

      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless <strong>JANUS Research Group LLC</strong> from claims, damages,
        and expenses (including reasonable legal fees) arising from your content, your use of the Service,
        or your violation of these Terms.
      </p>

      <h2>10. Third-Party Services</h2>
      <p>
        The Service relies on third-party providers (such as mapping and cloud-hosting services). Their
        terms and privacy practices apply to their components, and we are not responsible for them.
      </p>

      <h2>11. Privacy</h2>
      <p>
        Your use of the Service is also governed by our <Link to="/privacy">Privacy Policy</Link>, which
        describes the data we collect and how it is used and shared, including for AI/ML training,
        sharing with public-safety organizations, and potential future sharing with insurance providers
        and advertisers.
      </p>

      <h2>12. Modifications &amp; Termination</h2>
      <p>
        We may modify the Service or these Terms at any time. Material changes will be communicated
        through the Service, and continued use after changes take effect constitutes acceptance. We may
        suspend or terminate access for any reason, including violation of these Terms.
      </p>

      <h2>13. Governing Law &amp; Disputes</h2>
      <p>
        These Terms are governed by the laws of the <strong>State of Georgia, USA</strong>, without
        regard to conflict-of-laws rules. Disputes will be resolved in the state or federal courts
        located in <strong>Georgia, USA</strong>, unless otherwise required by applicable law.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms may be directed to <strong>JANUS Research Group LLC</strong> at{' '}
        <strong>kishan.shetty@janusresearch.us</strong>.
      </p>
    </LegalLayout>
  );
}
