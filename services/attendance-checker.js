import studentsModel from '../db/models/students.js';
import attendanceRecordsModel from '../db/models/attendance_records.js';
import pushService from './push-service.js';

/**
 * This function will run daily to check for students with low attendance.
 */
async function runDailyCheck() {
  console.log('Running daily attendance check...');
  
  try {
    // 1. Get all students from the database
    const allStudents = await studentsModel.findAll();

    // 2. Loop through each student to check their attendance
    for (const student of allStudents) {
      const history = await attendanceRecordsModel.getStudentAttendanceHistory(student.student_id);

      if (history.length === 0) {
        continue; // Skip students with no attendance records yet
      }

      // 3. Calculate their attendance percentage
      const totalClasses = history.length;
      const presentClasses = history.filter(h => h.status === 'Present').length;
      const percentage = (presentClasses / totalClasses) * 100;

      // 4. If percentage is below the threshold, send a notification
      if (percentage < 70) {
        console.log(`Student ${student.student_id} has low attendance (${percentage.toFixed(1)}%). Sending notification.`);
        
        const payload = {
          title: 'Attendance Warning',
          body: `Your attendance has dropped to ${percentage.toFixed(1)}%. Please ensure you attend future classes.`,
        };
        
        // The userType is always 'student' for this check
        await pushService.sendNotificationToUser(student.student_id, 'student', payload);
      }
    }
    console.log('Daily attendance check completed.');
  } catch (error) {
    console.error('An error occurred during the daily attendance check:', error);
  }
}

export default {
  runDailyCheck,
};