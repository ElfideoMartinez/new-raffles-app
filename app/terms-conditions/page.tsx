
const TermsConditionsPage = () => {
  return(
    <div className="flex flex-col justify-center mt-4 mx-4 items-center">
      <div className="w-5/6 lg:w-2/3 bg-white text-black p-4 rounded-card space-y-5">
        <p className="text-center text-xl">Terminos y Condiciones de Uso</p>
        <section className="">
          <p className="font-bold">*1. Introduccion*</p>
          <p>Bienvenido a Rifas MTZ (en adelante, "el Sitio"). Al acceder y utilizar este Sitio, usted acepta cumplir con los 
            siguientes términos y condiciones. Si no está de acuerdo con estos términos, le recomendamos que no utilice el Sitio.</p>
        </section>
        <section className="">
          <p className="font-bold">*2. Requisitos para Participar*</p>
          <ul>
            <li>- Debe ser mayor de edad según la legislación de su país de residencia.</li>
            <li>- La participación está sujeta a las leyes y regulaciones vigentes en su jurisdicción.</li>
            <li>- No está permitido el uso de métodos fraudulentos o engañosos para participar en las rifas.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*3. Registro y Cuenta de Usuario*</p>
          <ul>
            <li>- Para participar en las rifas, el usuario debe crear una cuenta proporcionando información veraz y actualizada.</li>
            <li>- Es responsabilidad del usuario mantener la confidencialidad de sus credenciales de acceso.</li>
            <li>- Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos términos.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*4. Compra de Boletos*</p>
          <ul>
            <li>- Cada boleto tiene un costo entre $10 y $200 MXN, dependiendo de la rifa.</li>
            <li>- La compra de boletos no garantiza la obtención de un premio.</li>
            <li>- No se admiten reembolsos una vez realizada la compra.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*5. Sorteo y Elección de Ganadores*</p>
          <ul>
            <li>- Los sorteos se realizarán en la fecha indicada en cada rifa.</li>
            <li>- El número ganador se seleccionará conforme a los números de la Rifa Nacional realizada cada mes.</li>
            <li>- Nos reservamos el derecho de verificar la identidad de los ganadores antes de la entrega del premio.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*6. Entrega de Premios*</p>
          <ul>
            <li>- Los ganadores serán notificados por correo electrónico o teléfono.</li>
            <li>- Los premios deben ser reclamados dentro del plazo indicado en cada rifa.</li>
            <li>- En caso de no reclamarse el premio en el tiempo estipulado, podrá ser reasignado o quedar desierto.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*7. Uso de Datos Personales*</p>
          <ul>
            <li>- La información personal de los participantes será tratada conforme a nuestra Política de Privacidad.</li>
            <li>- Nos reservamos el derecho de utilizar los datos de los ganadores para promocionar futuras rifas.</li>
            <li>- Para la eliminación de sus datos personales, los usuarios pueden contactar a <p className="underline">soporte@rifasmtz@gmail.com.</p></li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*8. Responsabilidad y Limitaciones*</p>
          <ul>
            <li>- No nos hacemos responsables por fallos técnicos o problemas ajenos a nuestro control que puedan afectar la participación en la rifa.</li>
            <li>- Nos reservamos el derecho de modificar, suspender o cancelar una rifa si se presentan circunstancias imprevistas.</li>
          </ul>
        </section>
        <section className="">
          <p className="font-bold">*9. Modificaciones a los Términos y Condiciones*</p>
          <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a los usuarios a través del Sitio.</p>
        </section>
        <section className="">
          <p className="font-bold">*10. Legislación Aplicable y Jurisdicción*</p>
          <p>Estos términos se rigen por las leyes de México y cualquier disputa será resuelta en los tribunales competentes del mismo.</p>
        </section>
        <ul>
          <li className="mt-3">Si tiene dudas o consultas, puede contactarnos a <p className="underline">soporte@rifasmtz@gmail.com.</p></li>
        </ul>
      </div>
    </div>
  )
};

export default TermsConditionsPage;