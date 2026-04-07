import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.testng.Assert;
import org.testng.annotations.Test;

public class CanteenTest {

    @Test
    public void testDeployedApp() {

        WebDriver driver = new ChromeDriver();
        driver.manage().window().maximize();

        driver.get("https://college-canteen-api.onrender.com");

        String page = driver.getPageSource();

        Assert.assertTrue(page.length() > 0);

        driver.quit();
    }
}