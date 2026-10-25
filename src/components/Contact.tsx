import { contact } from '../data/site';
import { ContactForm } from './ContactForm';
import { Footer } from './Footer';

export function Contact() {
  return (
    <section id="contact" className="contact scene-light" aria-labelledby="contact-title">
      <div className="contact__grid">
        <div className="contact__copy">
          <p className="label">Contact</p>
          <h2 id="contact-title" className="contact__title">
            Got an idea? <span>Let's ship it.</span>
          </h2>
          <p className="contact__lead">
            An AI feature, an automation or a whole app. Tell me what you need and I'll reply by email.
          </p>
          <p className="contact__alt">
            Prefer email? <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        </div>
        <div className="contact__frame">
          <span className="corners" aria-hidden="true" />
          <ContactForm />
        </div>
      </div>
      <Footer />
    </section>
  );
}
