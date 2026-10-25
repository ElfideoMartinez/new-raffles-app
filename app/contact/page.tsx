"use client";
import { useStorefrontConfig } from "@/app/config/storefrontConfig";

const ContactPage = () => {
  const contact = useStorefrontConfig();
  return (
    <div className="text-lg w-11/12 relative flex flex-col justify-center text-center p-6 mt-4 mx-auto">
      <h1 className="mb-5 text-lg">Contáctanos</h1>
      <p>{contact.contactIntro}</p><br/>
      <p>
        {contact.contactPhones.map((phone) => (
          <span key={phone}>
            📞 Teléfono: {phone}<br/>
          </span>
        ))}
        {contact.contactEmail ? <>📧 Correo: {contact.contactEmail}</> : null}
      </p>
    </div>
  )
}

export default ContactPage;
