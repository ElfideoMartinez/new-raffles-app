"use client";
import Link from "next/link";
import { useStorefrontConfig } from "@/app/config/storefrontConfig";

const ContactPage = () => {
  const contact = useStorefrontConfig();
  const ig = contact.instagram?.trim();
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
        {contact.contactEmail ? <>📧 Correo: {contact.contactEmail}<br/></> : null}
        {ig ? (
          <>
            📸 Instagram:{" "}
            <Link
              href={`https://instagram.com/${ig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-700 underline hover:text-brand-800"
            >
              @{ig}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  )
}

export default ContactPage;
