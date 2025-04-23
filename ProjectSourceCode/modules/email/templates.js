let confirmation_email_template = (event,user_index) => {

    let {user_emails,event_name,event_time,reminder_time,link,description} = event
    let [date,time] = formatDate(event_time);

    return `<div id="content">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(32, 18, 101, 0.15);">
            <div style="padding: 30px 30px 0px 30px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 15px;">⏳Time Bridge Reminders⌛️</div>
                <div style="color: #201265; font-size: 20px; margin-bottom: 15px; letter-spacing: 2px;">${user_emails[user_index]}: New Event!</div>
                <hr style="border-top: dotted 10px rgb(131, 131, 131); border-bottom: 0; border-left:0;border-right:0; width:75%;">
            </div>
    
            <div style="padding: 0 30px 30px 30px; text-align: center;">
                <div style="color: #636e72; margin-top:10px">
                    <p>📅 ${date}</p>
                    <p>⏰ ${time}</p>
                </div>
                <div style="margin: 15px 0;">
                    
                    <div style="border:2px solid rgba(0, 0, 0, 0.284);">
                        <h3>${event_name}: <a href=${link}>Link</a></h3>
                    </div>

                    <p>${description}</p>
                </div>
            </div>
        </div>`
}

let reminder_email_template = (event,user_index) => {

    let {user_emails,event_name,event_time,reminder_time,link,description} = event
    let [date,time] = formatDate(event_time);
    return `<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(32, 18, 101, 0.15);">
        <div style="padding: 30px 30px 0px 30px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 15px;">⏳Time Bridge Reminders⌛️</div>
            <div style="color: #201265; font-size: 20px; margin-bottom: 15px; letter-spacing: 2px;">${user_emails[user_index]}: Event Coming Up!</div>
            <hr style="border-top: dotted 10px rgb(131, 131, 131); border-bottom: 0; border-left:0;border-right:0; width:75%;">
        </div>

        <div style="padding: 0 30px 30px 30px; text-align: center;">
            <div style="color: #636e72; margin-top:10px">
                <p>📅 ${date}</p>
                <p>⏰ ${time}</p>
                <p>Starts in: ${reminder_time} minute${reminder_time > 1 ? "s": ""}</p>
            </div>
            <div style="margin: 15px 0;">
                <div style="border:2px solid rgba(0, 0, 0, 0.284);">
                    <h3>${event_name}: <a href=${link}>Link</a></h3>
                </div>

                <p>${description}</p>
            </div>
        </div>
    </div>`
}


/**
 * 
 * @param {Date} date 
 */
function formatDate(date) {

    // format date part: in d
    let months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let day_endings = ["st","nd","rd","th"]
    let [d, ignore] = date.toISOString().split("T")
    let [year,month,day] = d.split("-");
    month = months[Number(month)-1]
    d = `${month} ${Number(day)}${day > day_endings.length ? day_endings[3] : day_endings[day-1]} ${year}`


    // format time part: in t
    let t = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
    });
    
    return [d,t]
} 


module.exports = {confirmation_email_template, reminder_email_template}