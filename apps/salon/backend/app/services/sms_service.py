"""SMS service using Twilio for notifications."""

import os
from typing import Optional
from datetime import datetime, timezone

from ..core.database import get_collection


# Message templates by type and language
MESSAGE_TEMPLATES = {
    "appointment_reminder": {
        "en": "Hi {client_name}! Reminder: Your {service_name} appointment with {staff_name} at {salon_name} is {time_until}. Reply CONFIRM to confirm or call us to reschedule.",
        "es": "Hola {client_name}! Recordatorio: Su cita de {service_name} con {staff_name} en {salon_name} es {time_until}. Responda CONFIRMAR para confirmar o llame para reprogramar.",
        "fr": "Bonjour {client_name}! Rappel: Votre rendez-vous {service_name} avec {staff_name} chez {salon_name} est {time_until}. Repondez CONFIRMER ou appelez pour reporter.",
        "pt": "Ola {client_name}! Lembrete: Sua consulta de {service_name} com {staff_name} em {salon_name} e {time_until}. Responda CONFIRMAR ou ligue para remarcar.",
    },
    "appointment_confirmed": {
        "en": "Your appointment at {salon_name} on {date} at {time} has been confirmed. We look forward to seeing you!",
        "es": "Su cita en {salon_name} el {date} a las {time} ha sido confirmada. Esperamos verle!",
        "fr": "Votre rendez-vous chez {salon_name} le {date} a {time} est confirme. A bientot!",
        "pt": "Sua consulta em {salon_name} no dia {date} as {time} foi confirmada. Esperamos ve-lo!",
    },
    "waitlist_available": {
        "en": "Great news {client_name}! An opening just became available at {salon_name}. {service_name} with {staff_name} on {date} at {time}. Reply YES to book or NO to pass.",
        "es": "Buenas noticias {client_name}! Un espacio se abrio en {salon_name}. {service_name} con {staff_name} el {date} a las {time}. Responda SI para reservar o NO para pasar.",
        "fr": "Bonne nouvelle {client_name}! Une place vient de se liberer chez {salon_name}. {service_name} avec {staff_name} le {date} a {time}. Repondez OUI pour reserver ou NON.",
        "pt": "Otimas noticias {client_name}! Uma vaga ficou disponivel em {salon_name}. {service_name} com {staff_name} no dia {date} as {time}. Responda SIM para reservar ou NAO.",
    },
    "staff_change": {
        "en": "Hi {client_name}, your appointment at {salon_name} on {date} has been updated. Your new stylist will be {new_staff_name}. Reply OK to confirm or call us to reschedule.",
        "es": "Hola {client_name}, su cita en {salon_name} el {date} ha sido actualizada. Su nuevo estilista sera {new_staff_name}. Responda OK para confirmar o llame para reprogramar.",
        "fr": "Bonjour {client_name}, votre rendez-vous chez {salon_name} le {date} a ete modifie. Votre nouveau styliste sera {new_staff_name}. Repondez OK ou appelez pour reporter.",
        "pt": "Ola {client_name}, sua consulta em {salon_name} no dia {date} foi atualizada. Seu novo estilista sera {new_staff_name}. Responda OK ou ligue para remarcar.",
    },
    "cancellation_needed": {
        "en": "Hi {client_name}, unfortunately we need to reschedule your appointment at {salon_name} on {date}. Please call us at {phone} to find a new time.",
        "es": "Hola {client_name}, lamentablemente necesitamos reprogramar su cita en {salon_name} el {date}. Llame al {phone} para encontrar un nuevo horario.",
        "fr": "Bonjour {client_name}, nous devons malheureusement reporter votre rendez-vous chez {salon_name} le {date}. Appelez-nous au {phone}.",
        "pt": "Ola {client_name}, infelizmente precisamos remarcar sua consulta em {salon_name} no dia {date}. Ligue para {phone} para agendar.",
    },
    "review_request": {
        "en": "Hi {client_name}! Thanks for visiting {salon_name} today. We'd love your feedback! Leave us a review: {review_url}",
        "es": "Hola {client_name}! Gracias por visitar {salon_name} hoy. Nos encantaria su opinion! Dejenos una resena: {review_url}",
        "fr": "Bonjour {client_name}! Merci de votre visite chez {salon_name}. Nous aimerions votre avis! Laissez un commentaire: {review_url}",
        "pt": "Ola {client_name}! Obrigado por visitar {salon_name} hoje. Adorariamos sua opiniao! Deixe uma avaliacao: {review_url}",
    },
    "birthday": {
        "en": "Happy Birthday {client_name}! {salon_name} wishes you a wonderful day. Enjoy {discount} on your next visit this week!",
        "es": "Feliz Cumpleanos {client_name}! {salon_name} te desea un dia maravilloso. Disfruta {discount} en tu proxima visita esta semana!",
        "fr": "Joyeux Anniversaire {client_name}! {salon_name} vous souhaite une merveilleuse journee. Profitez de {discount} sur votre prochaine visite!",
        "pt": "Feliz Aniversario {client_name}! {salon_name} deseja um dia maravilhoso. Aproveite {discount} na sua proxima visita!",
    },
    "no_show_fee": {
        "en": "Hi {client_name}, you missed your appointment at {salon_name} on {date}. A no-show fee of {amount} has been charged per our policy. Questions? Call {phone}.",
        "es": "Hola {client_name}, no asistio a su cita en {salon_name} el {date}. Se cobro un cargo de {amount} por no presentarse. Preguntas? Llame al {phone}.",
        "fr": "Bonjour {client_name}, vous avez manque votre rendez-vous chez {salon_name} le {date}. Des frais de {amount} ont ete factures. Questions? Appelez {phone}.",
        "pt": "Ola {client_name}, voce faltou a sua consulta em {salon_name} no dia {date}. Foi cobrada uma taxa de {amount}. Duvidas? Ligue {phone}.",
    },
}


class SMSService:
    """Service for sending SMS messages via Twilio."""

    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.default_from_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.client = None

        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self.client = Client(self.account_sid, self.auth_token)
            except ImportError:
                print("Twilio library not installed. SMS disabled.")

    def is_configured(self) -> bool:
        """Check if Twilio is properly configured."""
        return self.client is not None and self.default_from_number is not None

    def get_template(
        self,
        template_type: str,
        language: str = "en",
        custom_template: Optional[str] = None,
    ) -> str:
        """Get message template for type and language."""
        if custom_template:
            return custom_template

        templates = MESSAGE_TEMPLATES.get(template_type, {})
        return templates.get(language, templates.get("en", ""))

    async def send_sms(
        self,
        to_number: str,
        message: str,
        from_number: Optional[str] = None,
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send an SMS message."""
        sms_log_collection = get_collection("sms_log")

        log_entry = {
            "to_number": to_number,
            "from_number": from_number or self.default_from_number,
            "message": message,
            "salon_id": salon_id,
            "created_at": datetime.now(timezone.utc),
            "status": "pending",
            "error": None,
            "twilio_sid": None,
        }

        if not self.is_configured():
            log_entry["status"] = "skipped"
            log_entry["error"] = "Twilio not configured"
            await sms_log_collection.insert_one(log_entry)
            return {"success": False, "error": "SMS not configured", "message_logged": True}

        try:
            result = self.client.messages.create(
                body=message,
                from_=from_number or self.default_from_number,
                to=to_number,
            )
            log_entry["status"] = "sent"
            log_entry["twilio_sid"] = result.sid
            await sms_log_collection.insert_one(log_entry)
            return {"success": True, "sid": result.sid}

        except Exception as e:
            log_entry["status"] = "failed"
            log_entry["error"] = str(e)
            await sms_log_collection.insert_one(log_entry)
            return {"success": False, "error": str(e)}

    async def send_templated_sms(
        self,
        to_number: str,
        template_type: str,
        params: dict,
        language: str = "en",
        custom_template: Optional[str] = None,
        from_number: Optional[str] = None,
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send an SMS using a template."""
        template = self.get_template(template_type, language, custom_template)
        if not template:
            return {"success": False, "error": f"Template not found: {template_type}"}

        try:
            message = template.format(**params)
        except KeyError as e:
            return {"success": False, "error": f"Missing template parameter: {e}"}

        return await self.send_sms(to_number, message, from_number, salon_id)

    async def send_appointment_reminder(
        self,
        client_phone: str,
        client_name: str,
        service_name: str,
        staff_name: str,
        salon_name: str,
        appointment_time: datetime,
        language: str = "en",
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send appointment reminder."""
        now = datetime.now(timezone.utc)
        time_diff = appointment_time - now

        if time_diff.total_seconds() < 3600:
            time_until = "in less than an hour"
        elif time_diff.total_seconds() < 86400:
            hours = int(time_diff.total_seconds() / 3600)
            time_until = f"in {hours} hour{'s' if hours > 1 else ''}"
        else:
            time_until = f"on {appointment_time.strftime('%B %d at %I:%M %p')}"

        return await self.send_templated_sms(
            to_number=client_phone,
            template_type="appointment_reminder",
            params={
                "client_name": client_name,
                "service_name": service_name,
                "staff_name": staff_name,
                "salon_name": salon_name,
                "time_until": time_until,
            },
            language=language,
            salon_id=salon_id,
        )

    async def send_waitlist_notification(
        self,
        client_phone: str,
        client_name: str,
        service_name: str,
        staff_name: str,
        salon_name: str,
        slot_time: datetime,
        language: str = "en",
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send waitlist availability notification."""
        return await self.send_templated_sms(
            to_number=client_phone,
            template_type="waitlist_available",
            params={
                "client_name": client_name,
                "service_name": service_name,
                "staff_name": staff_name,
                "salon_name": salon_name,
                "date": slot_time.strftime("%B %d"),
                "time": slot_time.strftime("%I:%M %p"),
            },
            language=language,
            salon_id=salon_id,
        )

    async def send_review_request(
        self,
        client_phone: str,
        client_name: str,
        salon_name: str,
        review_url: str,
        language: str = "en",
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send review request after appointment."""
        return await self.send_templated_sms(
            to_number=client_phone,
            template_type="review_request",
            params={
                "client_name": client_name,
                "salon_name": salon_name,
                "review_url": review_url,
            },
            language=language,
            salon_id=salon_id,
        )

    async def send_birthday_message(
        self,
        client_phone: str,
        client_name: str,
        salon_name: str,
        discount: str,
        language: str = "en",
        custom_message: Optional[str] = None,
        salon_id: Optional[str] = None,
    ) -> dict:
        """Send birthday greeting with optional discount."""
        return await self.send_templated_sms(
            to_number=client_phone,
            template_type="birthday",
            params={
                "client_name": client_name,
                "salon_name": salon_name,
                "discount": discount,
            },
            language=language,
            custom_template=custom_message,
            salon_id=salon_id,
        )


# Singleton instance
sms_service = SMSService()
